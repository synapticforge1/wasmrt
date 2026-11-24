//! A decoded WebAssembly module — pipeline stage 1 (decode).
//!
//! Ported from wazmrt `src/Module.zig` (T3). Validate the header, index the top-level
//! sections, and decode the type / import / function / tag / table / memory / global /
//! export / element / code / data sections. Every import and export is resolved to its
//! full [`Extern`] type. Validation, instantiation, and execution build on this type.
//!
//! **Ownership:** unlike wazmrt (which arena-owns everything), a `Module` holds owned
//! `Vec`/`String` fields, so it is independent of the input `bytes` and frees itself on
//! drop — there is no `deinit`.

use alloc::string::{String, ToString};
use alloc::vec::Vec;

use crate::opcode::HeapType;
use crate::reader::Reader;
use crate::types::{
    DecodeError, DecodeResult, ExternKind, RefHeap, SectionId, ValType, MAGIC, SUPPORTED_VERSION,
};

/// A top-level section, indexed by id and payload location (metadata only).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Section {
    pub id: SectionId,
    pub offset: usize,
    pub size: usize,
}

/// A function signature from the type section (§5.3.3).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FuncType {
    pub params: Vec<ValType>,
    pub results: Vec<ValType>,
}

/// A struct/array field's storage type (GC, §5.3.6). Packed `i8`/`i16` store narrow and
/// widen on read; an unpacked field holds an ordinary value type.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StorageType {
    Val(ValType),
    I8,
    I16,
}

impl StorageType {
    /// The value type this field projects onto the operand stack (packed → i32).
    #[must_use]
    pub const fn unpacked(self) -> ValType {
        match self {
            StorageType::Val(v) => v,
            StorageType::I8 | StorageType::I16 => ValType::I32,
        }
    }

    #[must_use]
    pub const fn is_packed(self) -> bool {
        !matches!(self, StorageType::Val(_))
    }
}

/// A struct field / array element type (GC): storage type + mutability.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FieldType {
    pub storage: StorageType,
    pub mutable: bool,
}

/// The composite-type kind of a type-section entry (GC).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompKind {
    Func,
    Struct,
    Array,
}

/// A composite type from the type section (§5.3): a function signature, a struct (a
/// vector of fields), or an array (a single element field).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CompType {
    Func(FuncType),
    Struct(Vec<FieldType>),
    Array(FieldType),
}

impl CompType {
    #[must_use]
    pub const fn kind(&self) -> CompKind {
        match self {
            CompType::Func(_) => CompKind::Func,
            CompType::Struct(_) => CompKind::Struct,
            CompType::Array(_) => CompKind::Array,
        }
    }
}

/// Resizable-range limits shared by tables and memories (§5.3.7). `shared` (threads) and
/// `is64` (memory64) apply only to memories. `min`/`max` are PAGE counts (a 64-bit memory
/// may declare up to 2^48 pages, so they are `u64`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Limits {
    pub min: u64,
    pub max: Option<u64>,
    pub shared: bool,
    pub is64: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TableType {
    pub element: ValType,
    pub limits: Limits,
    /// Raw constant-expression bytes (including the terminating `end`) every entry starts
    /// as — the function-references `0x40 0x00 tabletype expr` form. `None` is the plain
    /// form, whose entries start null.
    ///
    /// Only a *defined* table can carry one; an imported table takes its contents from the
    /// exporter.
    pub init: Option<Vec<u8>>,
}

/// A type's custom-descriptors links: `(describes $x)` and `(descriptor $y)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct TypeLinks {
    pub describes: Option<u32>,
    pub descriptor: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MemoryType {
    pub limits: Limits,
    /// The custom page size's exponent (custom-page-sizes: a page is `2^e` bytes), or `None` when
    /// the binary does not state one — which means 64 KiB. Kept as an `Option` because STATING the
    /// default is still using the proposal (the feature gate refuses the flag, not the value).
    pub page_size_log2: Option<u32>,
}

/// The default page size's exponent: 64 KiB.
pub const DEFAULT_PAGE_SIZE_LOG2: u32 = 16;

impl MemoryType {
    /// The page size's exponent — `limits.min`/`max`, `memory.size` and `memory.grow` all count
    /// in pages of `1 << page_size_log2()` bytes.
    #[must_use]
    pub const fn page_size_log2(&self) -> u32 {
        match self.page_size_log2 {
            Some(e) => e,
            None => DEFAULT_PAGE_SIZE_LOG2,
        }
    }
}

/// The largest page count a memory may have, for its index type and page size — the ONE rule the
/// validator (declared limits) and `memory.grow` (run time) both apply.
///
/// The memory may address at most `2^bits` bytes, so `2^(bits - e)` pages; with 1-byte pages that
/// is `2^bits` pages, which the limits cannot even express, so the ceiling is `2^bits - 1` (wasm-tools:
/// *"memory size must be at most 0xffffffff 1-byte pages"*). For 64 KiB pages: 65536 (32-bit) and
/// 2^48 (64-bit). `e` is assumed valid (0 or 16) or at least `< bits`; anything else is saturated.
///
/// ⚠️ Before custom-page-sizes these ceilings were written TWICE — `0x1_0000` / `0x1_0000_0000_0000` in
/// the validator and `65536` / `0x1_0000_0000_0000` in `memory_grow` — two copies of one rule, each of
/// which would have had to change in step.
#[must_use]
pub const fn max_pages(is64: bool, page_size_log2: u32) -> u64 {
    let bits: u32 = if is64 { 64 } else { 32 };
    if page_size_log2 == 0 {
        if is64 { u64::MAX } else { u32::MAX as u64 }
    } else if page_size_log2 >= bits {
        1
    } else {
        1u64 << (bits - page_size_log2)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GlobalType {
    pub content: ValType,
    pub mutable: bool,
}

/// The resolved type of an import or export.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Extern {
    Func(FuncType),
    Table(TableType),
    Memory(MemoryType),
    Global(GlobalType),
    /// An imported/exported exception tag (EH): a function type whose params are the
    /// exception's value types.
    Tag(FuncType),
}

impl Extern {
    #[must_use]
    pub const fn kind(&self) -> ExternKind {
        match self {
            Extern::Func(_) => ExternKind::Func,
            Extern::Table(_) => ExternKind::Table,
            Extern::Memory(_) => ExternKind::Memory,
            Extern::Global(_) => ExternKind::Global,
            Extern::Tag(_) => ExternKind::Tag,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Import {
    pub module: String,
    pub name: String,
    pub ty: Extern,
    /// For a **function** or **tag** import, the type **index** it was declared with; `None` for
    /// the other kinds.
    ///
    /// `ty` resolves that index to a `FuncType` structure, which is what the engine runs on — but a
    /// structure cannot answer *which type* this is, and for import matching that is the question.
    /// Two functions can both be `(func)` and still be different types, because rec-group membership
    /// is part of identity: `type-subtyping.wast` links `M10.f` (declared in a group whose sibling
    /// refers outward) against a `$f11` (in a group whose sibling refers inward) and must refuse.
    /// Comparing param/result lists cannot see that; comparing type indices can.
    pub func_type_index: Option<u32>,
    /// A custom-descriptors EXACT function import (kind `0x20`): it links only to a function whose
    /// type is EXACTLY the declared one — never a subtype — and `ref.func` of it is exact.
    pub exact: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Export {
    pub name: String,
    /// Index into the module's combined space for its kind (§5.5.10).
    pub index: u32,
    pub ty: Extern,
}

/// A data segment (§5.5.14). Active segments initialize linear memory at a const-expr
/// offset; passive segments are copied by `memory.init`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DataSegment {
    pub active: bool,
    pub mem_index: u32,
    /// Raw constant-expression bytes (including the terminating `end`); empty for passive.
    pub offset_expr: Vec<u8>,
    pub bytes: Vec<u8>,
}

/// The mode of an element segment (§5.5.12).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ElementMode {
    Active,
    Passive,
    Declarative,
}

/// An element segment (§5.5.12). Either a function-index list (`funcs`) or a vector of
/// const-expressions (`exprs`); exactly one is non-empty.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Element {
    pub mode: ElementMode,
    pub table_index: u32,
    pub offset_expr: Vec<u8>,
    pub funcs: Vec<u32>,
    pub exprs: Vec<Vec<u8>>,
    pub elem_type: ValType,
    /// Did the module SPELL `elem_type` (the expression forms with flags 5–7), rather than the
    /// decoder deriving it? Only a spelled type is a proposal the module USES. The function-index
    /// forms derive `(ref func)` (non-null, §5.5.12), and gating that DERIVED type through the
    /// value-type table refused every MVP element segment with function-references off: an
    /// ordinary compiled program under `--features mvp` (found by the H23 carry-forward, 2026-10-23).
    pub explicit_type: bool,
}

/// A run of consecutive locals of the same type in a code entry (§5.4.5).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Local {
    pub count: u32,
    pub ty: ValType,
}

/// A defined function's body from the code section (§5.5.13): its declared locals and its
/// instructions, decoded at decode time.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Code {
    pub locals: Vec<Local>,
    /// The body decoded to instructions, produced **at decode time**.
    ///
    /// Two reasons it lives here rather than being decoded on demand. First, correctness of
    /// *stage*: a malformed instruction encoding is a decode error by the spec, and while bodies
    /// were decoded lazily the decoder accepted modules the validator then had to reject —
    /// `assert_malformed` cases surfacing as validation failures. Second, it is less work: the
    /// validator and every instantiation each used to decode the same bytes again.
    ///
    /// This **replaced** a `body: Vec<u8>` field rather than joining it. Keeping both meant a
    /// second copy of every function body in every module, which is measurable on cold start —
    /// cold start being mostly decode — and nothing read the bytes once the IR existed.
    /// `body_offset` is what the raw form was actually needed for.
    pub ir: Vec<crate::opcode::Instr>,
    /// Absolute byte offset of the body within the original module binary (for truthful
    /// trap backtraces).
    pub body_offset: u32,
}

impl Code {
    /// Total number of declared locals (excludes parameters).
    #[must_use]
    pub fn local_count(&self) -> u64 {
        self.locals.iter().map(|l| u64::from(l.count)).sum()
    }
}

/// A decoded WebAssembly module. All fields are owned; a `Module` outlives its input.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Module {
    pub version: u32,
    pub sections: Vec<Section>,
    /// The type index space (§5.3): func / struct / array composite types, in declaration
    /// order (rec groups flattened into consecutive indices).
    pub comp_types: Vec<CompType>,
    /// Declared supertype of each type index (GC sub types), or `None`. Read by
    /// [`Module::is_subtype`].
    pub supertypes: Vec<Option<u32>>,
    /// `(start, len)` of each rec group, in type-index order. A type written without `(rec …)` is its
    /// own singleton group, which is what the spec says it is.
    ///
    /// Kept because the group — not the individual type — is the unit of identity, so anything that
    /// re-derives identity later (the store's cross-module type registry) needs the boundaries, and
    /// they cannot be recovered from `type_canon` alone.
    pub rec_groups: Vec<(u32, u32)>,
    /// **Canonical type identity**, parallel to `comp_types`: `type_canon[t]` is the *lowest* type
    /// index structurally equal to `t`, so two types are the same type iff their entries match.
    ///
    /// The spec decides type identity **structurally**, on canonical rec groups (§3.1.4) — two rec
    /// groups spelling out the same shape are one type. wasmrt otherwise compares concrete types by
    /// **index**, which is a different relation, and the gap showed up four ways at once: valid
    /// modules rejected, `ref.test` answering wrongly, `assert_trap` cases returning a result, and
    /// invalid modules accepted.
    ///
    /// Empty for a hand-built `Module` that never went through `decode`; [`Module::canon_id`] then
    /// falls back to the identity, which is exactly the old index-comparison behaviour.
    pub type_canon: Vec<u32>,
    /// Whether each type is **final** — closed to further subtyping. Parallel to `comp_types`.
    ///
    /// Final is the *default*: only the `0x50` (`sub`) wrapper opens a type. `0x4f` is `sub final`
    /// and a bare composite type is shorthand for `sub final ϵ`. Kept as its own vector rather than
    /// folded into `supertypes` because the two are independent — a type can be open with no
    /// supertype, or final with one.
    pub type_finals: Vec<bool>,
    /// Each type's custom-descriptors links, parallel to `comp_types`: the type it DESCRIBES and the
    /// type that is its DESCRIPTOR. Part of the type's identity (see `push_links`), and validated as
    /// a mutually-consistent pair within one rec group.
    pub type_links: Vec<TypeLinks>,
    /// Type index of each *defined* function, in order.
    pub functions: Vec<u32>,
    /// Type index of each *defined* exception tag (§5.5.14, EH).
    pub tags: Vec<u32>,
    pub imports: Vec<Import>,
    pub exports: Vec<Export>,
    /// Body of each defined function, positionally matching `functions`.
    pub code: Vec<Code>,
    /// The global index space (imported globals first, then defined).
    pub globals: Vec<GlobalType>,
    /// Init const-expr bytes for each *defined* global (the tail of `globals`).
    pub global_inits: Vec<Vec<u8>>,
    /// The memory index space (imported memories first, then defined).
    pub memories: Vec<MemoryType>,
    /// The table index space (imported tables first, then defined).
    pub tables: Vec<TableType>,
    pub data: Vec<DataSegment>,
    pub elements: Vec<Element>,
    /// The start function's index (§5.5.11).
    pub start: Option<u32>,
    /// Raw `vec(nameassoc)` payload of the name section's function-name subsection
    /// (§7.4.2), or `None`. Read via [`Module::func_name`] (consulted only on a trap).
    pub func_names: Option<Vec<u8>>,
}

impl Module {
    /// Return the first section with `id`, or `None`.
    #[must_use]
    pub fn section(&self, id: SectionId) -> Option<Section> {
        self.sections.iter().copied().find(|s| s.id == id)
    }

    /// Number of imported functions (they occupy the low function indices).
    #[must_use]
    pub fn imported_func_count(&self) -> u32 {
        self.imports.iter().filter(|i| matches!(i.ty, Extern::Func(_))).count() as u32
    }

    /// Number of imported exception tags.
    #[must_use]
    pub fn imported_tag_count(&self) -> u32 {
        self.imports.iter().filter(|i| matches!(i.ty, Extern::Tag(_))).count() as u32
    }

    /// Number of imported tables.
    #[must_use]
    pub fn imported_table_count(&self) -> u32 {
        self.imports.iter().filter(|i| matches!(i.ty, Extern::Table(_))).count() as u32
    }

    /// Number of imported memories.
    #[must_use]
    pub fn imported_memory_count(&self) -> u32 {
        self.imports.iter().filter(|i| matches!(i.ty, Extern::Memory(_))).count() as u32
    }

    /// Resolve a function index (imports first, then defined) to its signature.
    #[must_use]
    pub fn func_type(&self, index: u32) -> Option<FuncType> {
        let mut i: u32 = 0;
        for imp in &self.imports {
            if let Extern::Func(ft) = &imp.ty {
                if i == index {
                    return Some(ft.clone());
                }
                i += 1;
            }
        }
        let defined = (index - i) as usize;
        let ti = *self.functions.get(defined)?;
        self.func_sig(ti)
    }

    /// The type index of a function (imports first, then defined), or `None` for an
    /// imported function.
    #[must_use]
    pub fn func_type_index(&self, func_index: u32) -> Option<u32> {
        let imported = self.imported_func_count();
        if func_index < imported {
            return None;
        }
        let defined = (func_index - imported) as usize;
        self.functions.get(defined).copied()
    }

    /// The type index a function has IN THIS MODULE — its definition's, or for an import the index it
    /// was declared with. The STATIC type, which is what validation asks for: `ref.func x` has type
    /// `(ref $t)` for that `$t` whether `x` is defined or imported.
    ///
    /// ⚠️ Distinct from [`Self::func_type_index`], which answers `None` for an import ON PURPOSE: the
    /// run-time callers compare a function's ACTUAL type, and an import's actual type is its
    /// exporter's, which may be a strict subtype of what it was declared as.
    ///
    /// Added 2026-09-19: the validator used `func_type_index` and so typed `ref.func` of an IMPORTED
    /// function as the abstract `funcref`, refusing every valid use of one as a `(ref $f)` — in a
    /// global, a table, or a body. Hidden until the runner started validating `(module definition …)`.
    #[must_use]
    pub fn declared_func_type_index(&self, func_index: u32) -> Option<u32> {
        let imported = self.imported_func_count();
        if func_index >= imported {
            return self.func_type_index(func_index);
        }
        self.imports
            .iter()
            .filter(|i| i.ty.kind() == crate::types::ExternKind::Func)
            .nth(func_index as usize)
            .and_then(|i| i.func_type_index)
    }

    /// Is `ref.func` of function `fi` EXACT (custom-descriptors)? A defined function is: it has exactly
    /// its declared type. An import is only when it was declared exact — an inexact import may be bound
    /// to a strict subtype ("References to inexact imports are not exact").
    #[must_use]
    pub fn func_ref_is_exact(&self, func_index: u32) -> bool {
        let imported = self.imported_func_count();
        if func_index >= imported {
            return true;
        }
        self.imports
            .iter()
            .filter(|i| i.ty.kind() == crate::types::ExternKind::Func)
            .nth(func_index as usize)
            .is_some_and(|i| i.exact)
    }

    /// The function signature at type index `ti`, or `None` if out of range or a
    /// non-function composite type.
    #[must_use]
    pub fn func_sig(&self, ti: u32) -> Option<FuncType> {
        match self.comp_types.get(ti as usize)? {
            CompType::Func(f) => Some(f.clone()),
            _ => None,
        }
    }

    /// The **type index** an exception tag names (imports first, then defined), which is the tag's
    /// identity for §4.5.9 matching — [`Self::tag_type`] gives only its shape.
    #[must_use]
    pub fn tag_type_index(&self, tag_index: u32) -> Option<u32> {
        let mut i: u32 = 0;
        for imp in &self.imports {
            if matches!(imp.ty, Extern::Tag(_)) {
                if i == tag_index {
                    return imp.func_type_index;
                }
                i += 1;
            }
        }
        self.tags.get((tag_index - i) as usize).copied()
    }

    /// The function type an exception `tag` names (imports first, then defined).
    #[must_use]
    pub fn tag_type(&self, tag_index: u32) -> Option<FuncType> {
        let mut i: u32 = 0;
        for imp in &self.imports {
            if let Extern::Tag(ft) = &imp.ty {
                if i == tag_index {
                    return Some(ft.clone());
                }
                i += 1;
            }
        }
        let defined = (tag_index - i) as usize;
        let ti = *self.tags.get(defined)?;
        self.func_sig(ti)
    }

    /// The struct field vector at type index `ti`, or `None` if not a struct.
    #[must_use]
    pub fn struct_fields(&self, ti: u32) -> Option<&[FieldType]> {
        match self.comp_types.get(ti as usize)? {
            CompType::Struct(fs) => Some(fs),
            _ => None,
        }
    }

    /// The array element field at type index `ti`, or `None` if not an array.
    #[must_use]
    pub fn array_field(&self, ti: u32) -> Option<FieldType> {
        match self.comp_types.get(ti as usize)? {
            CompType::Array(f) => Some(*f),
            _ => None,
        }
    }

    /// Resolve a GC heap type to a reference-hierarchy head, mapping a concrete type index
    /// to its composite family. Errors if a concrete index is out of range.
    pub fn ref_head(&self, ht: HeapType) -> DecodeResult<RefHeap> {
        Ok(match ht {
            HeapType::Func => RefHeap::Func,
            HeapType::Extern => RefHeap::Extern,
            HeapType::NoFunc => RefHeap::NoFunc,
            HeapType::NoExtern => RefHeap::NoExtern,
            HeapType::NoExn => RefHeap::NoExn,
            HeapType::Any => RefHeap::Any,
            HeapType::Eq => RefHeap::Eq,
            HeapType::I31 => RefHeap::I31,
            HeapType::Struct => RefHeap::Struct,
            HeapType::Array => RefHeap::Array,
            HeapType::None => RefHeap::None,
            HeapType::Exn => RefHeap::Exn,
            HeapType::Concrete(ti) | HeapType::Exact(ti) => {
                let ct = self
                    .comp_types
                    .get(ti as usize)
                    .ok_or(DecodeError::IndexOutOfRange)?;
                match ct.kind() {
                    CompKind::Func => RefHeap::Func,
                    CompKind::Struct => RefHeap::Struct,
                    CompKind::Array => RefHeap::Array,
                }
            }
        })
    }

    /// Is type index `a` a (reflexive/transitive) subtype of `b`, walking the declared GC
    /// supertype chain?
    #[must_use]
    pub fn is_subtype(&self, a: u32, b: u32) -> bool {
        // Compared CANONICALLY, not by index: `a` may be a different index naming the same type as
        // `b`, or its supertype chain may pass through one. Every subtype question in the engine —
        // the validator's `subtype_of`, the declared-supertype check, and `ref.test`/`ref.cast` at
        // run time — comes through here, so this is where structural identity takes effect.
        let cb = self.canon_id(b);
        let mut cur = Some(a);
        while let Some(c) = cur {
            if self.canon_id(c) == cb {
                return true;
            }
            // Terminates because a declared supertype is always a strictly lower index (enforced at
            // decode), so the walk is finite even on a hand-built module.
            cur = self.supertypes.get(c as usize).copied().flatten();
        }
        false
    }

    /// The canonical identity of type `t` — the lowest type index structurally equal to it.
    ///
    /// Falls back to `t` itself when there is no canonical table (a `Module` built by hand rather
    /// than decoded), which reduces to comparing indices: the previous behaviour, not a panic.
    #[must_use]
    pub fn canon_id(&self, t: u32) -> u32 {
        self.type_canon.get(t as usize).copied().unwrap_or(t)
    }

    /// Are types `a` and `b` **the same type** (§3.1.4 structural identity)?
    #[must_use]
    pub fn types_equal(&self, a: u32, b: u32) -> bool {
        self.canon_id(a) == self.canon_id(b)
    }

    /// Are two value types the same type, deciding **concrete** references canonically?
    ///
    /// `==` on the packed bits is not the same question: a concrete reference packs a module-local
    /// type index, so two spellings of one type compare unequal. Nullability is part of the type and
    /// must still match — and so is EXACTNESS (custom-descriptors): `(ref (exact $t))` is not
    /// `(ref $t)`. Omitting it made a function taking an exact parameter "equal" to one taking an
    /// inexact one, which is what `call_indirect`'s structural fallback asks.
    #[must_use]
    pub fn val_types_equal(&self, a: ValType, b: ValType) -> bool {
        a == b
            || (a.is_concrete()
                && b.is_concrete()
                && a.is_non_null_ref() == b.is_non_null_ref()
                && a.is_exact() == b.is_exact()
                && self.types_equal(a.concrete_index(), b.concrete_index()))
    }

    /// Do two function signatures denote the same type, concrete references compared canonically?
    ///
    /// The slice equality is tried **first** because it is what almost every call sees, and it is a
    /// single memcmp; the per-element canonical walk runs only when the bits actually differ. That
    /// keeps `call_indirect`'s check off the canonical path in the common case.
    #[must_use]
    pub fn func_types_equal(&self, a: &FuncType, b: &FuncType) -> bool {
        if a.params == b.params && a.results == b.results {
            return true;
        }
        a.params.len() == b.params.len()
            && a.results.len() == b.results.len()
            && a.params
                .iter()
                .zip(&b.params)
                .all(|(&x, &y)| self.val_types_equal(x, y))
            && a.results
                .iter()
                .zip(&b.results)
                .all(|(&x, &y)| self.val_types_equal(x, y))
    }

    /// The name recorded for function `index` in the name section, if any. Scans linearly;
    /// a malformed entry just ends the scan (a bad name section is never a decode error).
    #[must_use]
    pub fn func_name(&self, index: u32) -> Option<&[u8]> {
        let bytes = self.func_names.as_deref()?;
        let mut r = Reader::new(bytes);
        let count = r.read_var_u32().ok()?;
        for _ in 0..count {
            let idx = r.read_var_u32().ok()?;
            let len = r.read_var_u32().ok()? as usize;
            let name = r.read_bytes(len).ok()?;
            if idx == index {
                return Some(name);
            }
            if idx > index {
                return None; // the vec is sorted by index
            }
        }
        None
    }
}

/// Working state threaded through the section decoders, accumulating the per-kind index
/// spaces (imported entries first, then defined) needed to resolve export indices.
#[derive(Default)]
struct Decoder {
    comp_types: Vec<CompType>,
    supertypes: Vec<Option<u32>>,
    type_finals: Vec<bool>,
    type_links: Vec<TypeLinks>,
    type_canon: Vec<u32>,
    rec_groups: Vec<(u32, u32)>,
    /// Composite kind of each type index, pre-scanned before bodies are decoded so a
    /// `(ref $t)` value type can collapse to the right family even for a forward reference.
    type_kinds: Vec<CompKind>,
    func_space: Vec<FuncType>,
    table_space: Vec<TableType>,
    mem_space: Vec<MemoryType>,
    global_space: Vec<GlobalType>,
    tag_space: Vec<FuncType>,
    global_init_space: Vec<Vec<u8>>,
    /// Functions imported so far: code entry k belongs to function `imported_funcs + k` (its params count
    /// toward the locals limit).
    imported_funcs: usize,
    /// The imports' and exports' type sizes so far (see [`add_type_size`]).
    type_size: u64,
    /// Which of the function, code and data sections were present (an empty one counts as present).
    function_section: bool,
    code_section: bool,
    data_section: bool,
    /// The first function body's error and its offset, held until the module's structure is read.
    body_error: Option<(DecodeError, Option<usize>)>,
}

/// wasmtime's effective type size (adopted 2026-11-24, the limits study: 100,000 imports of a 999-param type made a
/// 0.8 MB module claim 840 MB). Each import and export adds its type's size — a function or tag 2 + its params +
/// results, a table, memory or global 1 — to the module's own 1; reaching the limit refuses, at the entry.
fn add_type_size(d: &mut Decoder, ty: &Extern, at: usize) -> DecodeResult<()> {
    let size = match ty {
        Extern::Func(ft) | Extern::Tag(ft) => 2 + ft.params.len() as u64 + ft.results.len() as u64,
        Extern::Table(_) | Extern::Memory(_) | Extern::Global(_) => 1,
    };
    d.type_size += size;
    if 1 + d.type_size >= u64::from(limits::TYPE_SIZE) {
        crate::reader::note_decode_at(at);
        return Err(DecodeError::TypeSizeTooLarge);
    }
    Ok(())
}

/// wasmtime's implementation limits (review I11) — see [`crate::limits`], which holds them under the
/// notice of wasmparser, whose values they are (review L1).
pub(crate) use crate::limits;

/// A running total past a module-wide limit: `cur + added > max` refuses, noted at `at` (the section's
/// payload or the entry that crossed it), as "{what} count exceeds limit of {max}".
fn over(cur: usize, added: u32, max: usize, what: &'static str, at: usize) -> DecodeResult<()> {
    if cur.saturating_add(added as usize) > max {
        crate::reader::note_decode_at(at);
        return Err(DecodeError::LimitExceeded { what, limit: u32::try_from(max).unwrap_or(u32::MAX) });
    }
    Ok(())
}

/// A vector count past its limit, for [`Reader::read_count_with`]: "{what} size is out of bounds" at the
/// count's first byte.
pub(crate) fn bounded(max: usize, what: &'static str) -> impl FnOnce(u32, usize) -> DecodeResult<()> {
    move |n, at| {
        if n as usize > max {
            crate::reader::note_decode_at(at);
            return Err(DecodeError::SizeOutOfBounds(what));
        }
        Ok(())
    }
}

/// Decode a WebAssembly binary into an owned [`Module`]. `bytes` may be freed afterward.
pub fn decode(bytes: &[u8]) -> DecodeResult<Module> {
    crate::reader::reset_decode_at();
    let mut r = Reader::new(bytes);
    let res = decode_from(&mut r);
    if let Err(e) = &res {
        // The least precise note, so the last resort: where the module-level reader stood.
        crate::reader::note_failure(&r, e);
    }
    res
}

/// The byte offset, from the start of the module, of the last [`decode`] failure on this thread —
/// the number wasmtime prints as "(at offset N)". 🆕 3.0.0 (review I1, sibling C). `None` before
/// any failure, after a successful decode, and in a `no_std` build. Read it right after [`decode`] fails:
/// `opcode::decode_body` / `decode_expr`, called directly, leave a note that only the next `decode` clears.
#[must_use]
pub fn last_decode_offset() -> Option<u32> {
    crate::reader::decode_at().and_then(|p| u32::try_from(p).ok())
}

fn decode_from(r: &mut Reader) -> DecodeResult<Module> {
    if r.read_bytes(4)? != MAGIC {
        return Err(DecodeError::BadMagic);
    }
    let version = r.read_u32_le()?;
    if version != SUPPORTED_VERSION {
        return Err(DecodeError::UnsupportedVersion(version));
    }

    let mut d = Decoder::default();
    let mut sections: Vec<Section> = Vec::new();
    let mut functions: Vec<u32> = Vec::new();
    let mut tags: Vec<u32> = Vec::new();
    let mut imports: Vec<Import> = Vec::new();
    let mut exports: Vec<Export> = Vec::new();
    let mut code: Vec<Code> = Vec::new();
    let mut data: Vec<DataSegment> = Vec::new();
    let mut elements: Vec<Element> = Vec::new();
    let mut start: Option<u32> = None;
    let mut data_count: Option<u32> = None;
    let mut func_names: Option<Vec<u8>> = None;

    // Order index of the last non-custom section seen, to enforce §5.5.2.
    let mut last_order: Option<u8> = None;

    while !r.at_end() {
        let raw_id = r.read_byte()?;
        if raw_id > SectionId::MAX {
            if raw_id & 0x80 != 0 {
                // A continuation bit: wasmparser reads the id as a LEB and fails AT it (offset 8).
                crate::reader::note_decode_at(r.last_abs());
                return Err(DecodeError::InvalidSectionId(raw_id));
            }
            // wasmtime reports this at the section's payload, after its size (measured: offset 10
            // for `20 00` after the header); read the size so the note lands there too. Its payload must be
            // present first: a size past the file is end-of-file, at the payload (review F2, 2026-11-24).
            let size = r.read_var_u32()? as usize;
            crate::reader::note_decode_at(r.abs_pos());
            if size > r.remaining() {
                return Err(DecodeError::UnexpectedEof);
            }
            return Err(DecodeError::InvalidSectionId(raw_id));
        }
        let id = SectionId::from_u8(raw_id).ok_or(DecodeError::InvalidSectionId(raw_id))?;
        // Sections appear at most once, in the fixed order (§5.5.2); custom sections are exempt.
        // Strictly greater, not `>=`: a repeated section is as malformed as a misordered one, and
        // without this the second occurrence silently *replaced* the first — a repeated function
        // section changed the module's function count and only surfaced later as a count mismatch.
        if let Some(ord) = id.order() {
            if last_order.is_some_and(|prev| ord <= prev) {
                // Reported at the section's payload, after its size, as wasmtime does (offset 16 for a
                // second type section at 14).
                let _ = r.read_var_u32();
                crate::reader::note_decode_at(r.abs_pos());
                return Err(DecodeError::SectionOrder);
            }
            last_order = Some(ord);
        }
        let size = r.read_var_u32()? as usize;
        let offset = r.pos();
        // wasmtime reads the CODE section incrementally — its count, then each entry by its size — so a
        // section claiming more bytes than the file holds is judged by what it holds: a wrong count at the
        // count, and entries that end before the claimed size as "trailing bytes". Every other section must
        // be present whole.
        let available = if id == SectionId::Code { size.min(r.remaining()) } else { size };
        let claimed_past_end = size > available;
        let payload = r.read_bytes(available)?;
        sections.push(Section { id, offset, size });

        let mut sub = Reader::with_origin(payload, offset);
        // Any failure inside the section is noted where its reader stood (a more precise note made
        // deeper — a function body, a code entry — is kept: the first note wins).
        let step = (|| -> DecodeResult<()> {
        match id {
            SectionId::Custom => {
                let nlen = sub.read_var_u32()? as usize;
                let cname = sub.read_bytes(nlen)?;
                // A custom section's id is a name (§5.2.4), so it must be UTF-8.
                if core::str::from_utf8(cname).is_err() {
                    return Err(DecodeError::InvalidUtf8);
                }
                if cname == b"name" {
                    func_names = find_func_name_subsection(&mut sub);
                }
            }
            SectionId::Type => decode_type_section(&mut d, &mut sub)?,
            SectionId::Import => imports = decode_import_section(&mut d, &mut sub)?,
            SectionId::Function => {
                functions = decode_function_section(&mut d, &mut sub)?;
                d.function_section = true;
            }
            SectionId::Tag => tags = decode_tag_section(&mut d, &mut sub)?,
            SectionId::Table => decode_table_section(&mut d, &mut sub)?,
            SectionId::Memory => decode_memory_section(&mut d, &mut sub)?,
            SectionId::Global => decode_global_section(&mut d, &mut sub)?,
            SectionId::Export => exports = decode_export_section(&mut d, &mut sub)?,
            SectionId::Element => elements = decode_element_section(&d, &mut sub)?,
            SectionId::Code => {
                code = decode_code_section(&mut d, &mut sub, offset, claimed_past_end)?;
                d.code_section = true;
                if claimed_past_end {
                    crate::reader::note_decode_at(sub.abs_pos());
                    return Err(DecodeError::TrailingBytes);
                }
            }
            SectionId::Data => {
                data = decode_data_section(&mut sub, data_count)?;
                d.data_section = true;
            }
            SectionId::DataCount => {
                let n = sub.read_var_u32()?;
                if n as usize > limits::DATA_SEGMENTS {
                    crate::reader::note_decode_at(offset);
                    return Err(DecodeError::DataCountTooLarge);
                }
                data_count = Some(n);
            }
            SectionId::Start => start = Some(sub.read_var_u32()?),
        }

        // The section's contents must occupy exactly the size it declared. Custom sections are
        // exempt — everything after the name is arbitrary payload by definition, and the `name`
        // subsection walk deliberately stops early.
        //
        // Leftover bytes are not a cosmetic disagreement: the outer reader has already skipped
        // `size` bytes, so a section that under-reads means the producer and the decoder disagree
        // about the section's contents while still agreeing where the next one starts. Whatever
        // was in the gap is simply not in the module we built.
        if id != SectionId::Custom && !sub.at_end() {
            // wasmtime words the start section's leftovers on their own
            return Err(match id {
                SectionId::Start => DecodeError::SectionContent("start"),
                SectionId::DataCount => DecodeError::SectionContent("data count"),
                _ => DecodeError::SectionSizeMismatch,
            });
        }
        Ok(())
        })();
        if let Err(e) = step {
            crate::reader::note_failure(&sub, &e);
            return Err(e);
        }
    }

    // Constant expressions are stored as raw bytes and read by the validator and the interpreter,
    // each with its own little reader — so a malformed *encoding* inside one (an over-long LEB, a
    // truncated immediate) used to surface as a validation error. Structurally checking them here
    // puts that where it belongs. Unlike function bodies the result is discarded rather than
    // stored: a const-expr is a handful of bytes and both consumers want the raw form, so decoding
    // it twice costs nothing worth the data-model change.
    for expr in module_const_exprs(&d, &elements, &data) {
        // These are COPIES, already decoded in their sections, so a position noted in one would be
        // relative to the copy, not the module: drop it (the module-level note stands in).
        if let Err(e) = crate::opcode::decode_body(expr) {
            crate::reader::reset_decode_at();
            return Err(e);
        }
    }

    // The function and code sections must declare the same number of functions (§5.5.13). This is
    // a *decode*-stage check because it is a disagreement between two sections' structure, not a
    // typing fact — the validator also caught it, one stage too late, and `assert_malformed` is
    // the assertion the spec suite uses. Both empty is fine: a module may have neither section.
    // (A code section that disagrees is refused at its count; this is a code section that is absent.)
    if !d.code_section && !functions.is_empty() {
        return Err(DecodeError::FunctionWithoutCode);
    }
    if functions.len() != code.len() {
        return Err(DecodeError::FuncCodeCountMismatch);
    }

    // If present, the data-count section must equal the data-segment count (§5.5.16); a data section
    // that disagrees is refused at its end, so this is one that is absent.
    if data_count.is_some_and(|dc| dc > 0) && !d.data_section {
        return Err(DecodeError::DataCountWithoutData);
    }

    // The module's structure is sound: now a function body's own error, held until here because wasmtime
    // validates bodies only after parsing the whole module (so a structural fault later in the file is
    // reported first). At its own offset.
    if let Some((e, at)) = d.body_error.take() {
        crate::reader::reset_decode_at();
        if let Some(at) = at {
            crate::reader::note_decode_at(at);
        }
        return Err(e);
    }

    if data_count.is_none() && code
        .iter()
        .flat_map(|c| c.ir.iter())
        .any(|i| {
            matches!(
                i.op,
                // ⚠️ GC adds two more instructions that name a data segment. The list was written
                // when bulk-memory was the only proposal with any, and nothing re-read it when GC
                // landed: `array.new_data` / `array.init_data` in a data-count-less module were
                // accepted here while wasm-tools says "data count section required".
                crate::opcode::Op::MemoryInit
                    | crate::opcode::Op::DataDrop
                    | crate::opcode::Op::ArrayNewData
                    | crate::opcode::Op::ArrayInitData
            )
        })
    {
        // …and when ABSENT it is required, if any body references a data segment (bulk-memory).
        // The count is what lets `memory.init`'s segment index be checked without having read the
        // data section, so its absence is a decode-stage failure rather than a validation one.
        // Only reachable now that bodies are decoded here — the check needs the instructions.
        return Err(DecodeError::DataCountRequired);
    }

    Ok(Module {
        version,
        sections,
        comp_types: d.comp_types,
        supertypes: d.supertypes,
        type_finals: d.type_finals,
        type_links: d.type_links,
        type_canon: d.type_canon,
        rec_groups: d.rec_groups,
        functions,
        tags,
        imports,
        exports,
        code,
        globals: d.global_space,
        global_inits: d.global_init_space,
        memories: d.mem_space,
        tables: d.table_space,
        data,
        elements,
        start,
        func_names,
    })
}

/// Find the function-name subsection (id 1) inside a `name` custom section and return an
/// owned copy of its `vec(nameassoc)` payload. The name section is a convention: every
/// error degrades to "no names".
fn find_func_name_subsection(sub: &mut Reader) -> Option<Vec<u8>> {
    while !sub.at_end() {
        let kind = sub.read_byte().ok()?;
        let size = sub.read_var_u32().ok()? as usize;
        let payload = sub.read_bytes(size).ok()?;
        if kind == 1 {
            return Some(payload.to_vec());
        }
        if kind > 1 {
            break; // subsections are ordered; 2+ means we passed it
        }
    }
    None
}

// --- Low-level readers -------------------------------------------------------

/// Read one value type. Numeric types are themselves; abstract reference shorthands map to
/// their family head, and `(ref null? ht)` (0x63/0x64) resolves a concrete `$t` to its
/// family via the pre-scanned `kinds`.
fn read_val_type(r: &mut Reader, kinds: &[CompKind]) -> DecodeResult<ValType> {
    let b = r.read_byte()?;
    Ok(match b {
        // ⚠️ `0x57`–`0x68` are `ValType`'s INTERNAL tags for the non-null abstract references and
        // were accepted here as if they were value-type bytes. They are not: §5.3.5 spells
        // `(ref ht)` as `0x64 ht`, and nothing else. Accepting them let wasmrt read a binary no
        // other engine can — the mirror of the assembler emitting one (see `emit_val_type`), and
        // the pair is what kept the round trip green.
        0x63 => read_heap_type_ref(r, true, kinds)?, // (ref null ht)
        0x64 => read_heap_type_ref(r, false, kinds)?, // (ref ht) — non-nullable
        _ => one_byte_val_type(b).ok_or(DecodeError::BadValType)?,
    })
}

/// The value types spelled by ONE byte — the numeric and vector types and the abstract reference
/// shorthands. The one table for both [`read_val_type`] and the type pre-scan's `skip_val_type`
/// (review F1, 2026-11-24: the pre-scan took any byte, so a bad one ran on to the section's end).
fn one_byte_val_type(b: u8) -> Option<ValType> {
    Some(match b {
        0x7f => ValType::I32,
        0x7e => ValType::I64,
        0x7d => ValType::F32,
        0x7c => ValType::F64,
        0x7b => ValType::V128,
        0x70 => ValType::FUNCREF,
        0x6f => ValType::EXTERNREF,
        // The three hierarchy BOTTOMS. ⚠️ These aliased onto their tops — `nullfuncref` decoded as
        // `funcref` — which only null inhabits either way, but they are distinct types and
        // `ref.test (ref null nofunc)` on a real funcref must answer 0.
        0x73 => ValType::NULLFUNCREF,
        0x72 => ValType::NULLEXTERNREF,
        0x6e => ValType::ANYREF,
        0x6d => ValType::EQREF,
        0x6c => ValType::I31REF,
        0x6b => ValType::STRUCTREF,
        0x6a => ValType::ARRAYREF,
        0x71 => ValType::NULLREF, // none
        0x69 => ValType::EXNREF,
        0x74 => ValType::NULLEXNREF,
        _ => return None,
    })
}

/// Map a `heaptype` (following a `0x63`/`0x64` ref prefix) to a reference value type. A
/// non-negative `s33` is a concrete type index collapsing to its family head; negative
/// encodings are the abstract heap types.
///
/// Reads through [`crate::opcode::read_heap_type`], the ONE heap-type reader: this had its own copy of
/// the `s33` table until custom-descriptors, and a second copy is where the exact prefix `0x62` would
/// have been learned by one reader and not the other.
fn read_heap_type_ref(r: &mut Reader, nullable: bool, kinds: &[CompKind]) -> DecodeResult<ValType> {
    use crate::opcode::HeapType as H;
    let ht = crate::opcode::read_heap_type(r).map_err(|e| match e {
        // An unknown heap-type code in a VALUE type is a bad value type, as wasmtime words it.
        DecodeError::BadHeapType => DecodeError::BadValType,
        e => e,
    })?;
    if let H::Concrete(ti) | H::Exact(ti) = ht {
        let kind = kinds
            .get(ti as usize)
            .ok_or(DecodeError::IndexOutOfRange)?;
        let head = match kind {
            CompKind::Func => RefHeap::Func,
            CompKind::Struct => RefHeap::Struct,
            CompKind::Array => RefHeap::Array,
        };
        return Ok(if matches!(ht, H::Exact(_)) {
            ValType::exact_ref(nullable, head, ti)
        } else {
            ValType::concrete_ref(nullable, head, ti)
        });
    }
    let (n, nn) = match ht {
        H::Func => (ValType::FUNCREF, ValType::FUNCREF_NN),
        H::Extern => (ValType::EXTERNREF, ValType::EXTERNREF_NN),
        H::NoFunc => (ValType::NULLFUNCREF, ValType::NULLFUNCREF_NN),
        H::NoExtern => (ValType::NULLEXTERNREF, ValType::NULLEXTERNREF_NN),
        H::NoExn => (ValType::NULLEXNREF, ValType::NULLEXNREF_NN),
        H::Any => (ValType::ANYREF, ValType::ANYREF_NN),
        H::Eq => (ValType::EQREF, ValType::EQREF_NN),
        H::I31 => (ValType::I31REF, ValType::I31REF_NN),
        H::Struct => (ValType::STRUCTREF, ValType::STRUCTREF_NN),
        H::Array => (ValType::ARRAYREF, ValType::ARRAYREF_NN),
        H::None => (ValType::NULLREF, ValType::NULLREF_NN),
        H::Exn => (ValType::EXNREF, ValType::EXNREF_NN),
        H::Concrete(_) | H::Exact(_) => unreachable!("split off above"),
    };
    Ok(if nullable { n } else { nn })
}

fn read_val_types(r: &mut Reader, kinds: &[CompKind]) -> DecodeResult<Vec<ValType>> {
    let n = r.read_count()?;
    let mut vts = Vec::with_capacity(r.cap(n));
    for _ in 0..n {
        vts.push(read_val_type(r, kinds)?);
    }
    Ok(vts)
}

/// Copy a length-prefixed name (§5.2.4) into an owned `String`, rejecting non-UTF-8.
fn read_name(r: &mut Reader) -> DecodeResult<String> {
    let n = r.read_var_u32()? as usize;
    let src = r.read_bytes(n)?;
    match core::str::from_utf8(src) {
        Ok(s) => Ok(s.to_string()),
        Err(_) => Err(DecodeError::InvalidUtf8),
    }
}

fn read_limits(r: &mut Reader) -> DecodeResult<Limits> {
    // A table's flags define bits 0..2 only (no page size), refused at the flags byte.
    if r.peek_byte()? & !0b111 != 0 {
        r.read_byte()?;
        return Err(DecodeError::MalformedFlag("invalid table resizable limits flags"));
    }
    let (limits, _) = read_limits_flagged(r)?;
    Ok(limits)
}

/// A memory type: limits, then — when flag bit 3 says so — the custom page size's exponent.
fn read_memory_type(r: &mut Reader) -> DecodeResult<MemoryType> {
    let (limits, page_size_log2) = read_limits_flagged(r)?;
    Ok(MemoryType { limits, page_size_log2 })
}

/// Limits and, if flag bit 3 is set, the custom page size exponent that follows them.
///
/// Both bounds are read as **u64 whatever the index type** (Wasm 3.0 `limits`): a 32-bit memory
/// or table whose bound does not fit 32 bits is INVALID — "memory size must be at most …", the
/// validator's verdict — not a malformed LEB. wasmrt read u32 here until 2026-09-19, so
/// `(memory 0x1_0000_0000)` was refused one stage early; wasm-tools decodes it and refuses it at
/// validation.
fn read_limits_flagged(r: &mut Reader) -> DecodeResult<(Limits, Option<u32>)> {
    let flag_at = r.abs_pos();
    let flag = r.read_byte()?;
    // bit 0 = has max, bit 1 = shared (threads), bit 2 = i64 index (memory64),
    // bit 3 = custom page size (custom-page-sizes).
    if flag > 0x0f {
        return Err(DecodeError::MalformedFlag("invalid memory limits flags"));
    }
    let is64 = flag & 0x04 != 0;
    let min = r.read_var_u64()?;
    let max = if flag & 0x01 != 0 { Some(r.read_var_u64()?) } else { None };
    let page = if flag & 0x08 != 0 {
        let e = r.read_var_u32()?;
        // `2^e` must be a representable size at all; `e >= 64` is not (the spec test's 2^65).
        if e >= 64 {
            crate::reader::note_decode_at(flag_at); // at the flags byte, as wasmtime
            return Err(DecodeError::InvalidPageSize);
        }
        Some(e)
    } else {
        None
    };
    Ok((
        Limits {
            min,
            max,
            shared: flag & 0x02 != 0,
            is64,
        },
        page,
    ))
}

/// A reference type (a table's or element segment's type), worded as wasmtime words it: a byte that is no
/// reference type is "malformed reference type"; after a `0x63`/`0x64` prefix a bad heap type keeps its own
/// words ("invalid heap type").
fn read_ref_type(r: &mut Reader, kinds: &[CompKind]) -> DecodeResult<ValType> {
    let b = r.peek_byte()?;
    if b == 0x63 || b == 0x64 {
        r.read_byte()?;
        return read_heap_type_ref(r, b == 0x63, kinds);
    }
    r.read_byte()?;
    match one_byte_val_type(b) {
        Some(v) if v.is_ref() => Ok(v),
        _ => Err(DecodeError::BadRefType),
    }
}

fn read_table_type(r: &mut Reader, kinds: &[CompKind]) -> DecodeResult<TableType> {
    let element = read_ref_type(r, kinds)?;
    // ⚠️⚠️ §5.3.9 spells this field **reftype**: `tabletype ::= reftype limits`. Reading a
    // valtype here accepted `(table (elem i64) …)`, which decoded, VALIDATED and RAN —
    // `table.get` handed the guest the engine's null sentinel as an `i64` (`-1`) or a `v128`.
    // wasm-tools/wasmtime: "malformed reference type".
    //
    // 🎓 The element SEGMENT's type field had this exact defect and was fixed on its own
    // (see `an_element_segments_type_field_must_be_a_reference_type`) — the sibling site was
    // never swept, because the suite complained about only one of the two. **A fix belongs at
    // every site the grammar names, not at the one the failing test pointed to.**
    let limits = read_limits(r)?;
    // A table may be 64-bit (the table64 half of memory64, in scope since T13). A SHARED table is
    // shared-everything-threads, which wasmrt does not implement (wasmtime parses it).
    if limits.shared {
        return Err(DecodeError::UnimplementedProposal);
    }
    Ok(TableType {
        element,
        limits,
        init: None,
    })
}

fn read_global_type(r: &mut Reader, kinds: &[CompKind]) -> DecodeResult<GlobalType> {
    let content = read_val_type(r, kinds)?;
    let mutb = r.read_byte()?;
    if mutb > 0b11 {
        return Err(DecodeError::MalformedFlag("malformed global flags"));
    }
    if mutb & 0b10 != 0 {
        return Err(DecodeError::UnimplementedProposal); // a shared global: shared-everything-threads
    }
    Ok(GlobalType {
        content,
        mutable: mutb != 0,
    })
}

fn read_field_type(r: &mut Reader, kinds: &[CompKind]) -> DecodeResult<FieldType> {
    let storage = read_storage_type(r, kinds)?;
    let mutb = r.read_byte()?;
    if mutb > 0x01 {
        crate::reader::note_decode_at(r.abs_pos()); // after the byte, as wasmtime
        return Err(DecodeError::MalformedFlag("malformed mutability byte for field type"));
    }
    Ok(FieldType {
        storage,
        mutable: mutb != 0,
    })
}

/// Read a storage type: a packed `i8` (0x78) / `i16` (0x77), else a value type.
fn read_storage_type(r: &mut Reader, kinds: &[CompKind]) -> DecodeResult<StorageType> {
    match r.peek_byte()? {
        0x78 => {
            r.read_byte()?;
            Ok(StorageType::I8)
        }
        0x77 => {
            r.read_byte()?;
            Ok(StorageType::I16)
        }
        _ => Ok(StorageType::Val(read_val_type(r, kinds)?)),
    }
}

// --- Section decoders --------------------------------------------------------

/// Decode the type section (§5.5.4, GC §5.3): a vector of *rec types*. Runs a cheap kind
/// pre-scan first so a `(ref $t)` inside a field can collapse to the right family even for
/// a forward reference in the same rec group.
fn decode_type_section(d: &mut Decoder, r: &mut Reader) -> DecodeResult<()> {
    let mut scan = r.clone(); // Reader is a value cursor — clone for the pre-scan pass.
    d.type_kinds = prescan_type_kinds(&mut scan).inspect_err(|e| crate::reader::note_failure(&scan, e))?;

    let mut comp: Vec<CompType> = Vec::new();
    let mut supers: Vec<Option<u32>> = Vec::new();
    let mut finals: Vec<bool> = Vec::new();
    let mut links: Vec<TypeLinks> = Vec::new();
    // (start, len) of each rec group. A type written without `(rec …)` is its own singleton group,
    // which is what the spec says it is — so this needs no special case downstream.
    let mut groups: Vec<(u32, u32)> = Vec::new();
    let mut nrec = r.read_var_u32()?;
    while nrec > 0 {
        nrec -= 1;
        let start = comp.len() as u32;
        if r.peek_byte()? == 0x4e {
            r.read_byte()?; // rec group
            let mut k = r.read_var_u32()?;
            while k > 0 {
                k -= 1;
                decode_sub_type(&d.type_kinds, r, &mut comp, &mut supers, &mut finals, &mut links)?;
            }
        } else {
            decode_sub_type(&d.type_kinds, r, &mut comp, &mut supers, &mut finals, &mut links)?;
        }
        groups.push((start, comp.len() as u32 - start));
    }
    d.type_canon = canonicalize(&comp, &supers, &finals, &links, &groups);
    d.rec_groups = groups;
    d.comp_types = comp;
    d.supertypes = supers;
    d.type_finals = finals;
    d.type_links = links;
    Ok(())
}

/// Assign each type its **canonical identity**: the lowest type index structurally equal to it.
///
/// Rec groups are the unit of identity (§3.1.4), so each group is reduced to a structural key in
/// which a reference to a *member of the same group* becomes its position — making the group's shape
/// independent of where it landed in the index space — and a reference *outside* becomes the target's
/// already-assigned canonical id. Groups are keyed in order, so an outside reference is always to an
/// earlier group whose canonical id is known. The one exception is a reference forward out of the
/// group, which is invalid; it is keyed by a distinct sentinel so this stays **total**:
/// canonicalisation must never fail or panic on hostile input, and the bad index is the validator's
/// to report.
fn canonicalize(
    comp: &[CompType],
    supers: &[Option<u32>],
    finals: &[bool],
    links: &[TypeLinks],
    groups: &[(u32, u32)],
) -> Vec<u32> {
    // A `BTreeMap`, not a linear scan over previously-seen keys: the number of rec groups is
    // attacker-controlled, and a scan would be O(groups²) — a module of 100k singleton groups would
    // be a denial of service on the decoder. `alloc`'s BTreeMap needs no dependency and no hasher.
    let mut seen: alloc::collections::BTreeMap<Vec<u8>, u32> = alloc::collections::BTreeMap::new();
    let mut canon: Vec<u32> = Vec::with_capacity(comp.len());
    for &(start, len) in groups {
        // `canon` is filled in index order, so its length is exactly `start` here — which is what
        // makes "outside the group" and "not yet canonicalised" the same test in `push_type_ref`.
        let key = rec_group_key(comp, supers, finals, links, &canon, start, len);
        let first = *seen.entry(key).or_insert(start);
        for i in 0..len {
            canon.push(first + i);
        }
    }
    canon
}

/// The structural key of one rec group, keyed against **arbitrary already-assigned ids** for types
/// outside the group.
///
/// `outside` maps a type index to whatever identity the caller is keying by. Two callers use this with
/// different notions of identity and both need the same normalisation:
///
/// * [`canonicalize`] passes the module-local canonical ids, giving keys comparable **within** a module.
/// * [`crate::interp::Store`]'s type registry passes the **store-wide** ids of the module's earlier
///   groups, giving keys comparable **across** modules — which is the whole point of the registry, and
///   is why this is parameterised rather than reading `canon` directly.
#[allow(clippy::too_many_arguments)]
pub(crate) fn rec_group_key_with(
    comp: &[CompType],
    supers: &[Option<u32>],
    finals: &[bool],
    links: &[TypeLinks],
    outside: &[u32],
    start: u32,
    len: u32,
) -> Vec<u8> {
    rec_group_key(comp, supers, finals, links, outside, start, len)
}

/// The structural key of one rec group: every member in order, with type references normalised.
#[allow(clippy::too_many_arguments)]
fn rec_group_key(
    comp: &[CompType],
    supers: &[Option<u32>],
    finals: &[bool],
    links: &[TypeLinks],
    canon: &[u32],
    start: u32,
    len: u32,
) -> Vec<u8> {
    let mut k = Vec::new();
    for i in 0..len {
        let t = (start + i) as usize;
        // Finality and the declared supertype are part of a type's identity, not decoration: two
        // otherwise identical types differing in either are different types.
        k.push(u8::from(finals.get(t).copied().unwrap_or(true)));
        match supers.get(t).copied().flatten() {
            Some(s) => {
                k.push(1);
                push_type_ref(&mut k, canon, start, len, s);
            }
            None => k.push(0),
        }
        // 🔒 custom-descriptors: the `describes`/`descriptor` links are part of a type's IDENTITY —
        // two structs of one shape, one with a descriptor and one without, are different types (and
        // only one of them can be built by `struct.new`). This key is the ONE definition of identity
        // for all three places that need it: module-local canonicalisation, and the store-wide
        // registry's `assign` and `ids_readonly` — which is why the links are a PARAMETER here, so no
        // caller can omit them and still compile.
        let l = links.get(t).copied().unwrap_or_default();
        for link in [l.describes, l.descriptor] {
            match link {
                Some(x) => {
                    k.push(1);
                    push_type_ref(&mut k, canon, start, len, x);
                }
                None => k.push(0),
            }
        }
        match comp.get(t) {
            Some(CompType::Func(ft)) => {
                k.push(0x60);
                push_u32(&mut k, ft.params.len() as u32);
                for &v in &ft.params {
                    push_val_type(&mut k, canon, start, len, v);
                }
                push_u32(&mut k, ft.results.len() as u32);
                for &v in &ft.results {
                    push_val_type(&mut k, canon, start, len, v);
                }
            }
            Some(CompType::Struct(fs)) => {
                k.push(0x5f);
                push_u32(&mut k, fs.len() as u32);
                for f in fs {
                    push_field_type(&mut k, canon, start, len, f);
                }
            }
            Some(CompType::Array(f)) => {
                k.push(0x5e);
                push_field_type(&mut k, canon, start, len, f);
            }
            // Cannot happen for a decoded module; keyed distinctly rather than assumed away.
            None => k.push(0xff),
        }
    }
    k
}

fn push_u32(k: &mut Vec<u8>, v: u32) {
    k.extend_from_slice(&v.to_le_bytes());
}

fn push_field_type(k: &mut Vec<u8>, canon: &[u32], start: u32, len: u32, f: &FieldType) {
    k.push(u8::from(f.mutable));
    match f.storage {
        StorageType::I8 => k.push(0x78),
        StorageType::I16 => k.push(0x77),
        StorageType::Val(v) => push_val_type(k, canon, start, len, v),
    }
}

/// A value type, with a **concrete** reference reduced to (nullability, normalised target) so the
/// module-local type index it packs cannot leak into the key.
///
/// 🔒 EXACTNESS is part of the key (custom-descriptors): a struct with a `(ref (exact $t))` field and
/// one with a `(ref $t)` field are DIFFERENT types. Keyed on nullability alone, they would canonicalise
/// to one type — and a value of either would pass a cast to the other: type confusion at the level of
/// type identity, invisible to every subtyping check downstream because they would agree it is one type.
fn push_val_type(k: &mut Vec<u8>, canon: &[u32], start: u32, len: u32, v: ValType) {
    if v.is_concrete() {
        k.push(0xc0 | u8::from(v.is_non_null_ref()) | (u8::from(v.is_exact()) << 1));
        push_type_ref(k, canon, start, len, v.concrete_index());
    } else {
        k.push(0x00);
        push_u32(k, v.bits());
    }
}

fn push_type_ref(k: &mut Vec<u8>, canon: &[u32], start: u32, len: u32, t: u32) {
    if t >= start && t < start + len {
        // Inside this group: its POSITION, so the group's shape does not depend on where the group
        // sits in the index space. This is what makes two identical rec groups compare equal — and
        // what keeps a group that refers to its OWN member distinct from one referring outward.
        k.push(0x01);
        push_u32(k, t - start);
    } else if let Some(&c) = canon.get(t as usize) {
        k.push(0x02);
        push_u32(k, c);
    } else {
        // A reference forward, out of the group — invalid, and not canonicalisable. Keyed by its raw
        // index so two different bad modules are not accidentally equated, and so this stays total:
        // the validator reports the bad index; the decoder does not panic on it.
        k.push(0x03);
        push_u32(k, t);
    }
}

/// Everything a sub type states before its composite type.
struct SubPrefix {
    is_final: bool,
    super_idx: Option<u32>,
    /// How many supertypes were declared (up to 5, the limit); more than one is refused for the whole
    /// rec group by [`check_supertypes`].
    supers: u32,
    links: TypeLinks,
}

/// Read a sub type's prefix: an optional `0x50`/`0x4f` wrapper carrying a supertype list (GC MVP: at
/// most one), then — custom-descriptors — an optional `0x4c` describes and an optional `0x4d`
/// descriptor, in that order, each at most once.
///
/// 🔒 **The one reader of this prefix**, for the pre-scan AND the decoder. They each had their own copy
/// of the `sub` wrapper; D1 paid for a pre-scan that parsed less than the decoder (it misread the whole
/// type section), and a prefix is exactly where the two would diverge again. A repeated clause, or
/// `descriptor` before `describes`, leaves a `0x4c`/`0x4d` where the composite type must be, which is
/// "malformed definition type" in `binary-descriptors.wast`.
fn read_sub_prefix(r: &mut Reader) -> DecodeResult<SubPrefix> {
    let mut super_idx: Option<u32> = None;
    let mut supers = 0;
    let tag = r.peek_byte()?;
    // Only `0x50` (`sub`) declares a type OPEN for extension. `0x4f` is `sub final`, and a bare
    // composite type is shorthand for `sub final ϵ` — so **final is the default**, and the two
    // wrapper bytes are not interchangeable. Decoding both as "has a supertype list" and dropping
    // the distinction is what let a module declare a final type as its supertype.
    let is_final = tag != 0x50;
    if tag == 0x50 || tag == 0x4f {
        r.read_byte()?;
        // Any number may be declared (each index takes a byte, so the bytes bound the loop); more
        // than one is refused for the whole rec group by `check_supertypes`.
        let ns = r.read_var_u32()?;
        supers = ns;
        for i in 0..ns {
            let s = r.read_var_u32()?;
            if i == 0 {
                super_idx = Some(s);
            }
        }
    }
    let mut links = TypeLinks::default();
    if r.peek_byte()? == 0x4c {
        r.read_byte()?;
        links.describes = Some(r.read_var_u32()?);
    }
    if r.peek_byte()? == 0x4d {
        r.read_byte()?;
        links.descriptor = Some(r.read_var_u32()?);
    }
    Ok(SubPrefix { is_final, super_idx, supers, links })
}

/// Decode one sub type: its prefix ([`read_sub_prefix`]), then a composite type.
fn decode_sub_type(
    kinds: &[CompKind],
    r: &mut Reader,
    comp: &mut Vec<CompType>,
    supers: &mut Vec<Option<u32>>,
    finals: &mut Vec<bool>,
    links: &mut Vec<TypeLinks>,
) -> DecodeResult<()> {
    // The supertype count and order were judged by the pre-scan (`check_supertypes`), which runs first.
    let p = read_sub_prefix(r)?;
    comp.push(decode_comp_type(kinds, r)?);
    supers.push(p.super_idx);
    finals.push(p.is_final);
    links.push(p.links);
    Ok(())
}

/// Decode a composite type: `0x60` func / `0x5f` struct / `0x5e` array.
fn decode_comp_type(kinds: &[CompKind], r: &mut Reader) -> DecodeResult<CompType> {
    let form = r.read_byte()?;
    match form {
        0x60 => {
            let params = read_val_types(r, kinds)?;
            let results = read_val_types(r, kinds)?;
            Ok(CompType::Func(FuncType { params, results }))
        }
        0x5f => {
            let n = r.read_count()?;
            let mut fs = Vec::with_capacity(r.cap(n));
            for _ in 0..n {
                fs.push(read_field_type(r, kinds)?);
            }
            Ok(CompType::Struct(fs))
        }
        0x5e => Ok(CompType::Array(read_field_type(r, kinds)?)),
        _ => Err(DecodeError::InvalidLeadingByte { byte: form, what: "type" }),
    }
}

// --- Type-kind pre-scan (pass A): record each type's kind without resolving inner
// reference types (whose family may forward-reference a later type). Mirrors pass B.

fn prescan_type_kinds(r: &mut Reader) -> DecodeResult<Vec<CompKind>> {
    let mut kinds: Vec<CompKind> = Vec::new();
    let at = r.abs_pos();
    let mut nrec = r.read_var_u32()?;
    over(0, nrec, limits::TYPES, "types", at)?; // the rec-group count, at the payload (as wasmtime)
    while nrec > 0 {
        nrec -= 1;
        let group_at = r.abs_pos();
        if r.peek_byte()? == 0x4e {
            r.read_byte()?;
            let kat = r.abs_pos();
            let mut k = r.read_var_u32()?;
            bounded(limits::TYPES, "rec group types")(k, kat)?;
            over(kinds.len(), k, limits::TYPES, "types", group_at)?; // the running total, at the group
            let first = kinds.len();
            let mut group = Vec::new();
            while k > 0 {
                k -= 1;
                group.push(scan_sub_type(r, &mut kinds)?);
            }
            check_supertypes(first, &group, group_at)?;
        } else {
            over(kinds.len(), 1, limits::TYPES, "types", group_at)?;
            let first = kinds.len();
            let p = scan_sub_type(r, &mut kinds)?;
            check_supertypes(first, &[p], group_at)?;
        }
    }
    Ok(kinds)
}

/// A rec group's supertypes, judged once the group is read and at its start, as wasmtime: first any
/// type with more than one ("multiple supertypes"), then any naming itself or a later type
/// ("supertypes must be defined before subtypes") — so the chain strictly decreases and
/// `is_subtype`'s walk cannot loop. `first` is the group's first type index.
fn check_supertypes(first: usize, group: &[(u32, Option<u32>)], group_at: usize) -> DecodeResult<()> {
    let fail = |e| {
        crate::reader::note_decode_at(group_at);
        Err(e)
    };
    if group.iter().any(|&(n, _)| n > 1) {
        return fail(DecodeError::MultipleSupertypes);
    }
    for (k, &(_, sup)) in group.iter().enumerate() {
        if sup.is_some_and(|s| s as usize >= first + k) {
            return fail(DecodeError::SupertypeNotBefore);
        }
    }
    Ok(())
}

/// Scan one sub type, recording its kind; returns its supertype count and first supertype.
fn scan_sub_type(r: &mut Reader, kinds: &mut Vec<CompKind>) -> DecodeResult<(u32, Option<u32>)> {
    let p = read_sub_prefix(r)?;
    let form = r.read_byte()?;
    match form {
        0x60 => {
            skip_val_type_vec(r, limits::PARAMS, "function params")?;
            skip_val_type_vec(r, limits::RETURNS, "function returns")?;
            kinds.push(CompKind::Func);
        }
        0x5f => {
            let mut n = r.read_count_with(bounded(limits::STRUCT_FIELDS, "struct fields"))?;
            while n > 0 {
                n -= 1;
                skip_field_type(r)?;
            }
            kinds.push(CompKind::Struct);
        }
        0x5e => {
            skip_field_type(r)?;
            kinds.push(CompKind::Array);
        }
        _ => return Err(DecodeError::InvalidLeadingByte { byte: form, what: "type" }),
    }
    Ok((p.supers, p.super_idx))
}

fn skip_val_type_vec(r: &mut Reader, max: usize, what: &'static str) -> DecodeResult<()> {
    // A count larger than the bytes left is refused AT the count (each type takes a byte), as wasmtime
    // reports "function params size is out of bounds" there (review, 2026-11-23: it ran to the end).
    let mut n = r.read_count_with(bounded(max, what))?;
    while n > 0 {
        n -= 1;
        skip_val_type(r)?;
    }
    Ok(())
}

/// Advance past one value type without resolving it (bytes only).
///
/// ⚠️ The heap type is consumed by [`crate::opcode::read_heap_type`], the one reader, NOT a bare `s33`:
/// this was a THIRD copy of that reader, and it read the exact prefix `0x62` as the whole heap type —
/// leaving the type index behind, so every later byte of the type section was misread and the module
/// failed two types on as an "invalid composite type entry". A skipper must know the grammar exactly
/// as well as a reader does; it only gets to ignore the answer.
fn skip_val_type(r: &mut Reader) -> DecodeResult<()> {
    let b = r.read_byte()?;
    if b == 0x63 || b == 0x64 {
        crate::opcode::read_heap_type(r).map_err(|e| match e {
            DecodeError::BadHeapType => DecodeError::BadValType,
            e => e,
        })?;
    } else if one_byte_val_type(b).is_none() {
        return Err(DecodeError::BadValType);
    }
    Ok(())
}

fn skip_field_type(r: &mut Reader) -> DecodeResult<()> {
    let b = r.peek_byte()?;
    if b == 0x77 || b == 0x78 {
        r.read_byte()?; // packed i16 / i8
    } else {
        skip_val_type(r)?;
    }
    // The mutability byte, judged here as `read_field_type` judges it, so the pre-scan reports a bad
    // one before any fault later in the section (as wasmtime, which reads the section in order; I14).
    if r.read_byte()? > 0x01 {
        crate::reader::note_decode_at(r.abs_pos());
        return Err(DecodeError::MalformedFlag("malformed mutability byte for field type"));
    }
    Ok(())
}

fn func_type_at(d: &Decoder, type_index: u32) -> DecodeResult<FuncType> {
    match d
        .comp_types
        .get(type_index as usize)
        .ok_or(DecodeError::UnknownType(type_index))?
    {
        CompType::Func(f) => Ok(f.clone()),
        _ => Err(DecodeError::NotAFuncType(type_index)),
    }
}

fn decode_import_section(d: &mut Decoder, r: &mut Reader) -> DecodeResult<Vec<Import>> {
    let count = r.read_count_with(|n, at| over(0, n, limits::IMPORTS, "imports", at))?;
    let mut list = Vec::with_capacity(r.cap(count));
    for _ in 0..count {
        let entry_at = r.abs_pos();
        let module = read_name(r)?;
        let name = read_name(r)?;
        let byte = r.read_byte()?;
        // `0x20` is custom-descriptors' EXACT function import: a function import in every respect
        // but matching. (In an EXPORT the same byte is malformed, and stays `UnknownExternKind`.)
        let exact = byte == 0x20;
        let kind = if exact {
            ExternKind::Func
        } else {
            ExternKind::from_u8(byte).ok_or(DecodeError::InvalidLeadingByte { byte, what: "external kind" })?
        };
        let mut func_type_index = None;
        let ty = match kind {
            ExternKind::Func => {
                let ti = r.read_var_u32()?;
                let ft = func_type_at(d, ti).inspect_err(|_| crate::reader::note_decode_at(entry_at))?;
                d.func_space.push(ft.clone());
                // Kept alongside the resolved signature: identity questions need the index, not
                // the structure. See `Import::func_type_index`.
                func_type_index = Some(ti);
                Extern::Func(ft)
            }
            ExternKind::Table => {
                // An imported table never carries an initializer — the exporter owns the
                // contents — so this is always the plain form.
                let tt = read_table_type(r, &d.type_kinds)?;
                d.table_space.push(tt.clone());
                Extern::Table(tt)
            }
            ExternKind::Memory => {
                let mt = read_memory_type(r)?;
                d.mem_space.push(mt);
                Extern::Memory(mt)
            }
            ExternKind::Global => {
                let gt = read_global_type(r, &d.type_kinds)?;
                d.global_space.push(gt);
                Extern::Global(gt)
            }
            ExternKind::Tag => {
                // Tag import: an attribute byte (0 = exception) + a type index.
                if r.read_byte()? != 0x00 {
                    return Err(DecodeError::MalformedFlag("invalid tag attributes"));
                }
                let ti = r.read_var_u32()?;
                let ft = func_type_at(d, ti).inspect_err(|_| crate::reader::note_decode_at(entry_at))?;
                d.tag_space.push(ft.clone());
                // ⚠️ Keep the INDEX as well as the structure, for the same reason a function import
                // does: §4.5.9 matches a tag by its defined TYPE, and two tags can both be `(func)`
                // and still be different types — rec-group membership is part of identity and only
                // the index carries it. `tag.wast`'s link-time typing section is exactly that case.
                func_type_index = Some(ti);
                Extern::Tag(ft)
            }
        };
        // Each imported entity counts toward its kind's total, refused at this import (as wasmtime).
        match kind {
            ExternKind::Func => {
                d.imported_funcs += 1;
                over(d.func_space.len(), 0, limits::FUNCTIONS, "functions", entry_at)?;
            }
            ExternKind::Table => over(d.table_space.len(), 0, limits::TABLES, "tables", entry_at)?,
            ExternKind::Memory => {} // no count limit: a memory's cost is its pages (limits study)
            ExternKind::Global => over(d.global_space.len(), 0, limits::GLOBALS, "globals", entry_at)?,
            ExternKind::Tag => over(d.tag_space.len(), 0, limits::TAGS, "tags", entry_at)?,
        }
        add_type_size(d, &ty, entry_at)?;
        list.push(Import {
            module,
            name,
            ty,
            func_type_index,
            exact,
        });
    }
    Ok(list)
}

fn decode_function_section(d: &mut Decoder, r: &mut Reader) -> DecodeResult<Vec<u32>> {
    let count = r.read_count_with(|n, at| over(d.func_space.len(), n, limits::FUNCTIONS, "functions", at))?;
    let mut list = Vec::with_capacity(r.cap(count));
    for _ in 0..count {
        let ti = r.read_var_u32()?;
        let ft = func_type_at(d, ti)?;
        d.func_space.push(ft);
        list.push(ti);
    }
    Ok(list)
}

/// Tag section (§5.5.14, EH): each tag is an attribute byte (0x00 = exception) + a type
/// index. Returns the type indices.
fn decode_tag_section(d: &mut Decoder, r: &mut Reader) -> DecodeResult<Vec<u32>> {
    let count = r.read_count_with(|n, at| over(d.tag_space.len(), n, limits::TAGS, "tags", at))?;
    let mut list = Vec::with_capacity(r.cap(count));
    for _ in 0..count {
        let at = r.abs_pos(); // the tag's start: where wasmtime reports an unknown type (review P3)
        let attr = r.read_byte()?;
        if attr != 0x00 {
            return Err(DecodeError::MalformedFlag("invalid tag attributes"));
        }
        let ti = r.read_var_u32()?;
        let ft = func_type_at(d, ti).inspect_err(|_| crate::reader::note_decode_at(at))?;
        d.tag_space.push(ft);
        list.push(ti);
    }
    Ok(list)
}

fn decode_table_section(d: &mut Decoder, r: &mut Reader) -> DecodeResult<()> {
    let at = r.abs_pos();
    let mut count = r.read_var_u32()?;
    over(d.table_space.len(), count, limits::TABLES, "tables", at)?;
    while count > 0 {
        count -= 1;
        let entry_at = r.abs_pos();
        // §5.5.6 with function-references, two forms:
        //   tabletype                       — entries start null
        //   0x40 0x00 tabletype expr        — entries start as `expr`
        // `0x40` cannot begin a valtype, so peeking one byte disambiguates. Reading the
        // second form is what stops a table declared with an initializer from silently
        // instantiating full of nulls.
        let mut tt = if r.peek_byte()? == 0x40 {
            r.read_byte()?; // 0x40
            if r.read_byte()? != 0x00 {
                return Err(DecodeError::MalformedFlag("invalid table encoding"));
            }
            let mut tt = read_table_type(r, &d.type_kinds)?;
            tt.init = Some(read_const_expr_bytes(r)?);
            tt
        } else {
            read_table_type(r, &d.type_kinds)?
        };
        // A non-nullable element type is uninhabited without an initializer, so the plain
        // form cannot express it. Rejected here rather than producing a table of nulls
        // typed as non-null.
        if tt.init.is_none() && tt.element.is_non_null_ref() {
            crate::reader::note_decode_at(entry_at); // at the table, as wasmtime's validator
            return Err(DecodeError::MalformedFlag("type mismatch: non-defaultable element type"));
        }
        tt.limits.shared = false;
        d.table_space.push(tt);
    }
    Ok(())
}

fn decode_memory_section(d: &mut Decoder, r: &mut Reader) -> DecodeResult<()> {
    let mut count = r.read_var_u32()?;
    while count > 0 {
        count -= 1;
        let mt = read_memory_type(r)?;
        d.mem_space.push(mt);
    }
    Ok(())
}

fn decode_global_section(d: &mut Decoder, r: &mut Reader) -> DecodeResult<()> {
    let at = r.abs_pos();
    let mut count = r.read_var_u32()?;
    over(d.global_space.len(), count, limits::GLOBALS, "globals", at)?;
    while count > 0 {
        count -= 1;
        let gt = read_global_type(r, &d.type_kinds)?;
        d.global_space.push(gt);
        let init = read_const_expr_bytes(r)?;
        d.global_init_space.push(init);
    }
    Ok(())
}

fn decode_export_section(d: &mut Decoder, r: &mut Reader) -> DecodeResult<Vec<Export>> {
    let count = r.read_count_with(|n, at| over(0, n, limits::EXPORTS, "exports", at))?;
    let mut list = Vec::with_capacity(r.cap(count));
    for _ in 0..count {
        let entry_at = r.abs_pos();
        let name = read_name(r)?;
        let byte = r.read_byte()?;
        let kind = ExternKind::from_u8(byte).ok_or(DecodeError::InvalidLeadingByte { byte, what: "external kind" })?;
        let index = r.read_var_u32()?;
        // an index past its space is refused at the export, in wasmtime's words
        let unknown = |what| {
            crate::reader::note_decode_at(entry_at);
            DecodeError::UnknownExported { what, index }
        };
        let ty = match kind {
            ExternKind::Func => Extern::Func(space_at(&d.func_space, index).map_err(|_| unknown("function"))?),
            ExternKind::Table => Extern::Table(space_at(&d.table_space, index).map_err(|_| unknown("table"))?),
            ExternKind::Memory => Extern::Memory(space_at(&d.mem_space, index).map_err(|_| unknown("memory"))?),
            ExternKind::Global => Extern::Global(space_at(&d.global_space, index).map_err(|_| unknown("global"))?),
            ExternKind::Tag => Extern::Tag(space_at(&d.tag_space, index).map_err(|_| unknown("tag"))?),
        };
        add_type_size(d, &ty, entry_at)?;
        list.push(Export { name, index, ty });
    }
    Ok(list)
}

fn space_at<T: Clone>(space: &[T], index: u32) -> DecodeResult<T> {
    space
        .get(index as usize)
        .cloned()
        .ok_or(DecodeError::IndexOutOfRange)
}

fn decode_locals(r: &mut Reader, kinds: &[CompKind], params: usize) -> DecodeResult<Vec<Local>> {
    let n = r.read_count()?;
    let mut locals = Vec::with_capacity(r.cap(n));
    // wasmtime's limit (I11): params plus declared locals past 50,000, refused at the entry that crosses
    // it ("too many locals: locals exceed maximum"). The validator's `MAX_LOCALS` is the same number.
    let mut total: u64 = params as u64;
    for _ in 0..n {
        let at = r.abs_pos();
        let count = r.read_var_u32()?;
        total += u64::from(count);
        if total > limits::LOCALS {
            crate::reader::note_decode_at(at);
            return Err(DecodeError::TooManyLocals);
        }
        let ty = read_val_type(r, kinds)?;
        locals.push(Local { count, ty });
    }
    Ok(locals)
}

/// Copy a length-prefixed byte vector into owned memory.
fn read_byte_vec(r: &mut Reader) -> DecodeResult<Vec<u8>> {
    let n = r.read_var_u32()? as usize;
    Ok(r.read_bytes(n)?.to_vec())
}

/// Capture the raw bytes of a constant expression (through its `end`).
///
/// 🔒 The expression is walked by [`crate::opcode::decode_expr`] — the same decoder that reads
/// function bodies — and the instructions are dropped; only the byte range is wanted here. This
/// used to be a hand-written `skip_const_expr` that knew the immediate shape of *some* constant
/// instructions, and the two it did not know (`struct.new_desc`, and `ref.null` with an `exact`
/// heap type) each made a VALID module undecodable. See `decode_expr`'s own comment: a second
/// authority on the instruction grammar is the T10a mechanism, and it fails the same way every
/// time — silently, on whatever was added after it was written.
fn read_const_expr_bytes(r: &mut Reader) -> DecodeResult<Vec<u8>> {
    let start = r.pos();
    crate::opcode::decode_const_expr(r)?;
    Ok(r.input()[start..r.pos()].to_vec())
}

fn read_func_vec(r: &mut Reader, seg_at: usize) -> DecodeResult<Vec<u32>> {
    let n = r.read_count()?;
    let mut funcs = Vec::with_capacity(r.cap(n));
    for _ in 0..n {
        funcs.push(r.read_var_u32()?);
    }
    too_many_elements(n, seg_at)?;
    Ok(funcs)
}

/// An element segment past 10,000,000 elements, refused at the segment's start. wasmtime checks it
/// AFTER reading the items, so a truncated or malformed item is reported first; so does wasmrt.
fn too_many_elements(n: u32, seg_at: usize) -> DecodeResult<()> {
    if n as usize > limits::TABLE_ENTRIES {
        crate::reader::note_decode_at(seg_at);
        return Err(DecodeError::TooManyElements);
    }
    Ok(())
}

/// Read a vector of element const-expressions (each terminated by `end`).
fn read_expr_vec(r: &mut Reader, seg_at: usize) -> DecodeResult<Vec<Vec<u8>>> {
    let n = r.read_count()?;
    let mut exprs = Vec::with_capacity(r.cap(n));
    for _ in 0..n {
        exprs.push(read_const_expr_bytes(r)?);
    }
    too_many_elements(n, seg_at)?;
    Ok(exprs)
}

/// Decode the element section (§5.5.12): all 8 flag variants.
fn decode_element_section(d: &Decoder, r: &mut Reader) -> DecodeResult<Vec<Element>> {
    let count = r.read_count_with(|n, at| over(0, n, limits::ELEMENT_SEGMENTS, "element segments", at))?;
    let mut list = Vec::with_capacity(r.cap(count));
    for _ in 0..count {
        let seg_at = r.abs_pos(); // a segment with too many elements is refused at its start (as wasmtime)
        let flags = r.read_var_u32()?;
        // §5.5.12 defines exactly EIGHT segment forms, so the flags field is three bits. It was
        // read as an unbounded `u32` and only bits 0..2 were ever examined, which meant `flags = 8`
        // decoded as flags 0 — a different segment form — instead of being refused; wasm-tools
        // says "invalid flags byte in element segment". ⚠️ Examining the bits a form needs is not
        // the same as rejecting the bits no form defines.
        if flags > 7 {
            crate::reader::note_decode_at(r.abs_pos().saturating_sub(1)); // the flags' last byte, as wasmtime
            return Err(DecodeError::MalformedFlag("invalid flags byte in element segment"));
        }
        let mut table_index = 0u32;
        let mut offset_expr: Vec<u8> = Vec::new();
        let mut funcs: Vec<u32> = Vec::new();
        let mut exprs: Vec<Vec<u8>> = Vec::new();
        let mut elem_type = ValType::FUNCREF;
        let mut explicit_type = false;
        // bit0: 0 = active; bit1 (when bit0=1): 0 = passive, 1 = declarative.
        let mode = if flags & 0b001 == 0 {
            ElementMode::Active
        } else if flags & 0b010 == 0 {
            ElementMode::Passive
        } else {
            ElementMode::Declarative
        };
        // bit1 (of active) selects an explicit table index; bit2 selects the expr form.
        if mode == ElementMode::Active && (flags & 0b010) != 0 {
            table_index = r.read_var_u32()?;
        }
        if mode == ElementMode::Active {
            offset_expr = read_const_expr_bytes(r)?;
        }
        if flags & 0b100 == 0 {
            // Func-index form. Non-flag-0 variants carry a leading elemkind byte.
            if flags != 0 {
                // elemkind: `0x00` (funcref) is the only one defined, and the byte was being read
                // and discarded — wasm-tools: "only the function external type is supported in
                // elem segment".
                if r.read_byte()? != 0x00 {
                    return Err(DecodeError::MalformedFlag("only the function external type is supported in elem segment"));
                }
            }
            funcs = read_func_vec(r, seg_at)?;
            // ⚠️ §5.5.12 with function-references: the funcidx **shorthand** forms have type
            // `(ref func)` — NON-NULL — because every element is `(ref.func y)`, which can never
            // be null. The default above is the nullable `funcref`, and that difference is not
            // cosmetic: it decides whether such a segment may initialise a table declared
            // `(ref func)`. It could not, so `(table 1 (ref func) …) (elem (i32.const 0) func 0)`
            // — a **valid** module the spec ships five times in `elem.wast` — was refused as a
            // TypeMismatch. *A nullable default is the safe-looking choice and the wrong one:
            // here it under-approximates the type and rejects valid input.*
            elem_type = ValType::FUNCREF_NN;
        } else {
            // Const-expr form. Non-flag-4 variants carry a leading reftype byte.
            if flags != 4 {
                elem_type = read_ref_type(r, &d.type_kinds)?;
                explicit_type = true;
                // ⚠️ §5.5.12 spells this field **reftype**, not valtype — so `\7f` (i32) here is
                // MALFORMED, and the suite says so ("malformed reference type"). Reading it as a
                // valtype accepted the module and left the complaint to the validator, which
                // reported a `TypeMismatch` at a completely different stage. **Rejection STAGE is
                // part of correctness** (§3.6): `assert_malformed` is not satisfied by an
                // `assert_invalid`-shaped answer, and a caller told "invalid" reasonably concludes
                // the bytes were well-formed.
                if !elem_type.is_ref() {
                    return Err(DecodeError::BadValType);
                }
            }
            exprs = read_expr_vec(r, seg_at)?;
        }
        list.push(Element {
            mode,
            table_index,
            offset_expr,
            funcs,
            exprs,
            elem_type,
            explicit_type,
        });
    }
    Ok(list)
}

fn decode_data_section(r: &mut Reader, data_count: Option<u32>) -> DecodeResult<Vec<DataSegment>> {
    // A count unlike the data-count section's is refused at the section's END, before any segment is read
    // (wasmtime checks it as the section is delimited); then the limit.
    let end = r.abs_pos() + r.remaining();
    let count = r.read_count_with(|n, at| {
        if data_count.is_some_and(|dc| dc != n) {
            crate::reader::note_decode_at(end);
            return Err(DecodeError::DataCountMismatch);
        }
        over(0, n, limits::DATA_SEGMENTS, "data segments", at)
    })?;
    let mut list = Vec::with_capacity(r.cap(count));
    for _ in 0..count {
        let seg = match r.read_var_u32()? {
            // segment flags (§5.5.14)
            0 => {
                let offset_expr = read_const_expr_bytes(r)?;
                let bytes = read_byte_vec(r)?;
                DataSegment { active: true, mem_index: 0, offset_expr, bytes }
            }
            1 => DataSegment {
                active: false,
                mem_index: 0,
                offset_expr: Vec::new(),
                bytes: read_byte_vec(r)?,
            },
            2 => {
                let mem_index = r.read_var_u32()?;
                let offset_expr = read_const_expr_bytes(r)?;
                let bytes = read_byte_vec(r)?;
                DataSegment { active: true, mem_index, offset_expr, bytes }
            }
            _ => return Err(DecodeError::MalformedFlag("invalid flags byte in data segment")),
        };
        list.push(seg);
    }
    Ok(list)
}

/// `payload_base` is the code section payload's absolute offset in the module, so each
/// body can record where its bytes live in the original binary.
/// Every constant expression a module carries, as raw byte slices: global initializers, table
/// initializers (function-references), element-segment offsets and element expressions, and
/// data-segment offsets.
///
/// One list so the decode-time encoding check cannot miss a kind — the alternative, five separate
/// loops at the call site, is exactly the shape that grows a sixth const-expr field and forgets it.
fn module_const_exprs<'a>(
    d: &'a Decoder,
    elements: &'a [Element],
    data: &'a [DataSegment],
) -> impl Iterator<Item = &'a [u8]> {
    // Keyed on the segment MODE, not on whether the byte string is empty: a *passive* segment has
    // no offset expression at all, while an *active* one whose expression is empty is genuinely
    // malformed. Filtering by `is_empty()` would conflate the two and silently excuse the second.
    d.global_init_space
        .iter()
        .map(Vec::as_slice)
        .chain(d.table_space.iter().filter_map(|t| t.init.as_deref()))
        .chain(elements.iter().flat_map(|e| {
            (e.mode == ElementMode::Active)
                .then_some(e.offset_expr.as_slice())
                .into_iter()
                .chain(e.exprs.iter().map(Vec::as_slice))
        }))
        .chain(
            data.iter()
                .filter(|s| s.active)
                .map(|s| s.offset_expr.as_slice()),
        )
}

fn decode_code_section(d: &mut Decoder, r: &mut Reader, payload_base: usize, truncated: bool) -> DecodeResult<Vec<Code>> {
    // A code count that disagrees with the function section is refused AT the count, before its
    // bodies are read (as wasmtime); the check after the decode loop covers a missing code section.
    let declared = d.func_space.len() - d.imported_funcs;
    let function_section = d.function_section;
    let count = r.read_count_with(|n, at| {
        if n as usize != declared {
            crate::reader::note_decode_at(at);
            return Err(if !function_section && n > 0 { DecodeError::CodeWithoutFunction } else { DecodeError::FuncCodeCountMismatch });
        }
        Ok(())
    })?;
    let mut list = Vec::with_capacity(r.cap(count));
    for k in 0..count as usize {
        // Each entry is a byte-counted (locals ++ body) blob; decode within it so a
        // malformed local vector can't run past the entry.
        let size_at = r.abs_pos();
        let entry_len = r.read_var_u32()? as usize;
        let entry_start = r.pos();
        // An entry running past its section is reported at its size (wasmtime delimits each entry by the
        // section); past the FILE (a truncated section) where the bytes ran out (review F1, 2026-11-24).
        let entry = match r.read_bytes(entry_len) {
            Ok(e) => e,
            Err(e) => {
                if !truncated {
                    crate::reader::note_decode_at(size_at);
                }
                return Err(e);
            }
        };
        if entry_len > limits::FUNCTION_SIZE {
            // at the byte after the size, as wasmtime ("function body size count exceeds limit")
            crate::reader::note_decode_at(payload_base + entry_start);
            let limit = u32::try_from(limits::FUNCTION_SIZE).unwrap_or(u32::MAX);
            return Err(DecodeError::LimitExceeded { what: "function body size", limit });
        }
        let params = d.func_space.get(d.imported_funcs + k).map_or(0, |ft| ft.params.len());
        let mut er = Reader::with_origin(entry, payload_base + entry_start);
        // A body's own error (its locals or its instructions) is HELD, at its offset, until the module's
        // structure has been read (`decode`'s end), and the entries are still walked by their sizes.
        let hold = |d: &mut Decoder, e: DecodeError| {
            if d.body_error.is_none() {
                d.body_error = Some((e, crate::reader::decode_at()));
            }
            crate::reader::reset_decode_at();
        };
        let locals = match decode_locals(&mut er, &d.type_kinds, params) {
            Ok(l) => l,
            Err(e) => {
                crate::reader::note_failure(&er, &e);
                hold(d, e);
                list.push(Code { locals: Vec::new(), ir: Vec::new(), body_offset: 0 });
                continue;
            }
        };
        // Decode the body HERE, borrowing the entry rather than copying it out first. A malformed
        // instruction stream is a decode error by the spec, and deferring it meant `decode`
        // accepted modules the validator then rejected — the wrong stage, and measurably so
        // (`binary-leb128.wast` reported 15 such assertions). Doing it once also replaces two later
        // decodes of the same bytes (the validator's, and each instantiation's).
        let ir = match crate::opcode::decode_body_at(&entry[er.pos()..], er.abs_pos()) {
            Ok(ir) => ir,
            Err(e) => {
                hold(d, e);
                Vec::new()
            }
        };
        // The body starts `er.pos()` into the entry, which began at `entry_start`.
        // Saturate rather than truncate (only used to label a trap backtrace).
        let body_offset = u32::try_from(payload_base + entry_start + er.pos()).unwrap_or(u32::MAX);
        list.push(Code {
            locals,
            ir,
            body_offset,
        });
    }
    // Bytes after the last entry: wasmtime's words for the code section's leftovers, at the first of them.
    if !r.at_end() {
        crate::reader::note_decode_at(r.abs_pos());
        return Err(DecodeError::TrailingBytes);
    }
    Ok(list)
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;

    /// Prepend the wasm magic + version to a section byte sequence.
    fn m(rest: &[u8]) -> Vec<u8> {
        let mut v = vec![0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
        v.extend_from_slice(rest);
        v
    }

    /// Review I1, sibling C (2026-11-23): every decode failure carries the byte offset wasmtime
    /// reports for it. Each expected offset below was MEASURED with wasm-tools 1.263 on the same bytes.
    #[test]
    fn decode_failures_carry_wasmtimes_offset() {
        let ty = [0x01, 0x04, 0x01, 0x60, 0x00, 0x00];
        let func = [0x03, 0x02, 0x01, 0x00];
        let body = |b: &[u8]| -> Vec<u8> {
            let mut v = m(&ty);
            v.extend_from_slice(&func);
            v.extend_from_slice(&[0x0a, u8::try_from(b.len() + 2).unwrap(), 0x01, u8::try_from(b.len()).unwrap()]);
            v.extend_from_slice(b);
            v
        };
        let table = [0x04, 0x04, 0x01, 0x70, 0x00, 0x01];
        let cases: [(&str, Vec<u8>, DecodeError, u32); 37] = [
            // review F1–F4 (2026-11-24): measured with wasm-tools on these bytes
            ("a code entry past its section (not the file): at its size", m(&[&ty[..], &func[..], &[0x0a, 0x04, 0x01, 0x05, 0x00, 0x0b, 0x00, 0x03, 0x01, 0x61, 0x62]].concat()), DecodeError::UnexpectedEof, 21),
            ("an unknown section id whose size runs past the file", m(&[0x68, 0x72, 0x00]), DecodeError::UnexpectedEof, 10),
            ("an unknown section id whose payload is present", m(&[0x68, 0x02, 0x00, 0x00]), DecodeError::InvalidSectionId(0x68), 10),
            ("an element segment's kind byte", m(&[&ty[..], &func[..], &table[..], &[0x09, 0x05, 0x01, 0x03, 0x01, 0x01, 0x00, 0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b]].concat()), DecodeError::MalformedFlag("only the function external type is supported in elem segment"), 28),
            ("an element segment's type, not a reference type", m(&[&ty[..], &func[..], &table[..], &[0x09, 0x07, 0x01, 0x05, 0x7f, 0x01, 0xd2, 0x00, 0x0b, 0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b]].concat()), DecodeError::BadRefType, 28),
            // review F1: a count past the bytes is NOT refused up front — the items are read, so a
            // malformed one is reported at itself, as wasmtime reports it
            ("a bad item in an over-long params vector", m(&[0x01, 0x04, 0x01, 0x60, 0x05, 0x99]), DecodeError::BadValType, 13),
            ("a bad item in an over-long struct", m(&[0x01, 0x05, 0x01, 0x5f, 0x05, 0x99, 0x00]), DecodeError::BadValType, 13),
            ("a bad kind in an over-long export vector", m(&[0x07, 0x05, 0x05, 0x01, 0x61, 0x09, 0x00]), DecodeError::InvalidLeadingByte { byte: 9, what: "external kind" }, 13),
            ("a bad type in an over-long locals vector", body(&[0x05, 0x01, 0x99, 0x0b]), DecodeError::BadValType, 24),
            // a count past its implementation limit, at the count (I11: wasmtime's limits)
            ("a params count past the limit", m(&[0x01, 0x07, 0x01, 0x60, 0xff, 0xff, 0xff, 0xff, 0x0f]), DecodeError::SizeOutOfBounds("function params"), 12),
            ("a results count past the limit", m(&[0x01, 0x08, 0x01, 0x60, 0x00, 0xff, 0xff, 0xff, 0xff, 0x0f]), DecodeError::SizeOutOfBounds("function returns"), 13),
            // a count under every limit but past the bytes: where the bytes run out (I11, correcting P3)
            ("a params count past the section", m(&[0x01, 0x04, 0x01, 0x60, 0xe8, 0x07]), DecodeError::UnexpectedEof, 14),
            ("an export count past the section", m(&[0x07, 0x01, 0x03]), DecodeError::UnexpectedEof, 11),
            ("a br_table count past the body", body(&[0x00, 0x41, 0x00, 0x0e, 0x03, 0x00]), DecodeError::UnexpectedEof, 28),
            ("a truncated element item", m(&[&ty[..], &func[..], &[0x09, 0x05, 0x01, 0x01, 0x00, 0x02, 0x80]].concat()), DecodeError::UnexpectedEof, 25),
            // a code count unlike the function count: at the code count, before any body (as wasmtime)
            ("a code count past the function count", m(&[&ty[..], &func[..], &[0x0a, 0x04, 0x02, 0x02, 0x00, 0x0b]].concat()), DecodeError::FuncCodeCountMismatch, 20),
            // review P2 / P3 (2026-11-23): an overflowing LEB at its last byte; a high-bit section id at
            // itself; a body's bad value type and `br_table` count at their own bytes; a tag's start.
            ("an over-long LEB section size", m(&[0x01, 0x80, 0x80, 0x80, 0x80, 0x80, 0x00]), DecodeError::LebOverflow { ty: "var_u32", too_long: true }, 13),
            ("an over-long LEB in a body", body(&[0x00, 0x41, 0x80, 0x80, 0x80, 0x80, 0x80, 0x00, 0x1a, 0x0b]), DecodeError::LebOverflow { ty: "var_i32", too_long: true }, 28),
            ("a section id with the high bit", m(&[0xff, 0x00]), DecodeError::InvalidSectionId(0xff), 8),
            ("a bad block type", body(&[0x00, 0x02, 0x55, 0x0b, 0x0b]), DecodeError::BadValType, 24),
            // no br_table limit (the limits study): a huge count reads targets until the body ends
            ("a br_table count past the body", body(&[0x00, 0x41, 0x00, 0x0e, 0xff, 0xff, 0xff, 0xff, 0x0f, 0x0b]), DecodeError::UnexpectedEof, 32),
            ("a tag naming no type", m(&[0x0d, 0x03, 0x01, 0x00, 0x05]), DecodeError::UnknownType(5), 11),
            ("bad version", vec![0x00, 0x61, 0x73, 0x6d, 0x02, 0x00, 0x00, 0x00], DecodeError::UnsupportedVersion(2), 4),
            ("truncated header", vec![0x00, 0x61, 0x73, 0x6d, 0x01, 0x00], DecodeError::UnexpectedEof, 4),
            ("truncated section size", m(&[0x01, 0x80]), DecodeError::UnexpectedEof, 10),
            ("unknown section id", m(&[0x20, 0x00]), DecodeError::InvalidSectionId(0x20), 10),
            ("section past the end", m(&[0x01, 0x10, 0x01]), DecodeError::UnexpectedEof, 10),
            ("a repeated section", m(&[ty, ty].concat()), DecodeError::SectionOrder, 16),
            ("a bad type form", m(&[0x01, 0x04, 0x01, 0x61, 0x00, 0x00]), DecodeError::InvalidLeadingByte { byte: 0x61, what: "type" }, 11),
            ("a section with bytes left over", m(&[0x01, 0x05, 0x01, 0x60, 0x00, 0x00, 0x00]), DecodeError::SectionSizeMismatch, 14),
            ("a custom name not UTF-8", m(&[0x00, 0x03, 0x02, 0xff, 0xfe]), DecodeError::InvalidUtf8, 12),
            ("an illegal opcode", body(&[0x00, 0x27, 0x0b]), DecodeError::IllegalOpcode(0x27), 23),
            ("a body without its end", body(&[0x00, 0x01]), DecodeError::MissingEnd, 24),
            ("bytes after the body's end", body(&[0x00, 0x0b, 0x01]), DecodeError::UnbalancedEnd, 24),
            ("a truncated LEB in a body", body(&[0x00, 0x41, 0x80]), DecodeError::UnexpectedEof, 25),
            ("atomic.fence's nonzero byte", {
                let mut v = body(&[0x00, 0xfe, 0x03, 0x01, 0x0b]);
                // a memory section, so the fence is the only fault (inserted before the code section)
                let code_at = v.len() - 9;
                v.splice(code_at..code_at, [0x05, 0x03, 0x01, 0x00, 0x01]);
                v
            }, DecodeError::MalformedFlag("nonzero byte after `atomic.fence`"), 28),
            ("a function section without a code section", m(&[&ty[..], &func[..]].concat()), DecodeError::FunctionWithoutCode, 18),
        ];
        for (name, bytes, err, at) in cases {
            assert_eq!(decode(&bytes).err(), Some(err), "{name}");
            assert_eq!(last_decode_offset(), Some(at), "{name}: wasm-tools reports offset {at}");
        }
        // A successful decode clears the record.
        decode(&m(&ty)).expect("a type section alone decodes");
        assert_eq!(last_decode_offset(), None);
    }

    /// 🔒 wasmtime's implementation limits (I11, owner 2026-11-23). Each case is one count just past a
    /// limit, and each expected message and offset is what wasm-tools 1.263 (wasmtime 51's parser)
    /// reported for the same bytes. The `_at_limit` cases are accepted by both.
    #[test]
    #[allow(clippy::too_many_lines)]
    fn wasmtimes_implementation_limits() {
        fn leb(mut n: usize) -> Vec<u8> {
            let mut o = Vec::new();
            loop {
                let b = u8::try_from(n & 0x7f).unwrap();
                n >>= 7;
                if n == 0 {
                    o.push(b);
                    return o;
                }
                o.push(b | 0x80);
            }
        }
        fn sec(id: u8, p: &[u8]) -> Vec<u8> {
            [&[id][..], &leb(p.len()), p].concat()
        }
        let t0 = sec(1, &[1, 0x60, 0, 0]);
        let f1 = sec(3, &[1, 0]);
        let code = |b: &[u8]| sec(10, &[&[1][..], &leb(b.len()), b].concat());
        let func = |b: &[u8]| m(&[t0.clone(), f1.clone(), code(b)].concat());
        let t1 = sec(1, &[1, 0x60, 1, 0x7f, 0]); // (func (param i32))
        let one_import = sec(2, &[1, 1, b'm', 1, b'f', 0x00, 0]);
        let lim = |what, limit| DecodeError::LimitExceeded { what, limit };
        let size = DecodeError::SizeOutOfBounds;
        let cases: Vec<(&str, Vec<u8>, DecodeError, u32)> = vec![
            ("types", m(&sec(1, &leb(1_000_001))), lim("types", 1_000_000), 10),
            ("rec group types", m(&sec(1, &[&[1, 0x4e][..], &leb(1_000_001)].concat())), size("rec group types"), 12),
            ("params", m(&sec(1, &[&[1, 0x60][..], &leb(1001)].concat())), size("function params"), 12),
            ("results", m(&sec(1, &[&[1, 0x60, 0][..], &leb(1001)].concat())), size("function returns"), 13),
            ("struct fields", m(&sec(1, &[&[1, 0x5f][..], &leb(10_001)].concat())), size("struct fields"), 12),
            ("imports", m(&sec(2, &leb(1_000_001))), lim("imports", 1_000_000), 10),
            ("functions", m(&sec(3, &leb(1_000_001))), lim("functions", 1_000_000), 10),
            ("functions with an import", m(&[t0.clone(), one_import, sec(3, &leb(1_000_000))].concat()), lim("functions", 1_000_000), 25),
            ("tables", m(&sec(4, &leb(100_001))), lim("tables", 100_000), 10),
            ("globals", m(&sec(6, &leb(1_000_001))), lim("globals", 1_000_000), 10),
            ("exports", m(&sec(7, &leb(1_000_001))), lim("exports", 1_000_000), 10),
            ("element segments", m(&sec(9, &leb(100_001))), lim("element segments", 100_000), 10),
            ("data count", m(&sec(12, &leb(100_001))), DecodeError::DataCountTooLarge, 10),
            ("data segments", m(&sec(11, &leb(100_001))), lim("data segments", 100_000), 10),
            ("tags", m(&sec(13, &leb(1_000_001))), lim("tags", 1_000_000), 10),
            ("locals", func(&[&[1][..], &leb(50_001), &[0x7f, 0x0b]].concat()), DecodeError::TooManyLocals, 23),
            ("locals, at the entry that crosses", func(&[&[2][..], &leb(50_000), &[0x7f, 1, 0x7e, 0x0b]].concat()), DecodeError::TooManyLocals, 27),
            ("locals and a param", m(&[t1.clone(), f1.clone(), code(&[&[1][..], &leb(50_000), &[0x7f, 0x0b]].concat())].concat()), DecodeError::TooManyLocals, 24),
            ("catches", func(&[&[0, 0x1f, 0x40][..], &leb(10_001), &[0x0b]].concat()), size("catches"), 25),
            ("an element count past the bytes (end of input first)", m(&sec(9, &[&[1, 0x01, 0x00][..], &leb(10_000_001)].concat())), DecodeError::UnexpectedEof, 17),
            ("a supertype index at the limit is judged as an index", m(&sec(1, &[&[1, 0x50, 1][..], &leb((1 << 20) - 1), &[0x5f, 0]].concat())), DecodeError::SupertypeNotBefore, 11),
        ];
        for (name, bytes, err, at) in cases {
            assert_eq!(decode(&bytes).err(), Some(err), "{name}");
            assert_eq!(last_decode_offset(), Some(at), "{name}: wasm-tools reports offset {at}");
        }

        // The ones that need real bytes past the limit, and the same one byte short, which both accept.
        let body = |n: usize| {
            let mut b = vec![0x01u8; n]; // no locals, nops, end
            b[0] = 0;
            b[n - 1] = 0x0b;
            b
        };
        assert_eq!(decode(&func(&body(7_654_322))).err(), Some(lim("function body size", 7_654_321)));
        assert_eq!(last_decode_offset(), Some(28));
        decode(&func(&body(7_654_321))).expect("a body of exactly the limit");
        let elem = |n: usize| {
            let p = [&[1, 0x01, 0x00][..], &leb(n), &vec![0u8; n]].concat();
            m(&[t0.clone(), f1.clone(), sec(9, &p), code(&[0, 0x0b])].concat())
        };
        assert_eq!(decode(&elem(10_000_001)).err(), Some(DecodeError::TooManyElements));
        assert_eq!(last_decode_offset(), Some(24));
        decode(&elem(10_000_000)).expect("a segment of exactly the limit");
        // no subtype-depth limit (the limits study: a cast walks the chain, so depth costs time per cast,
        // not memory): a chain 64 deep — past wasmtime's 63 — is accepted
        let chain = |n: usize| {
            let mut p = [&leb(n + 1)[..], &[0x50, 0, 0x5f, 0]].concat();
            for i in 1..=n {
                p.extend([&[0x50, 1][..], &leb(i - 1), &[0x5f, 0]].concat());
            }
            m(&sec(1, &p))
        };
        decode(&chain(64)).expect("a chain 64 deep");
        // the effective type size: each import or export of a 999-param, no-result function counts 1,001, and
        // the module 1 — so 999 of them reach 1,000,000 and the 999th is refused at its start; 998 are not
        let imports = |n: usize| {
            let mut p = leb(n);
            for i in 0..n {
                let name = i.to_string();
                p.extend([&[1, b'm'][..], &leb(name.len()), name.as_bytes(), &[0x00, 0]].concat());
            }
            m(&[sec(1, &[&[1, 0x60][..], &leb(999), &[0x7f; 999], &[0]].concat()), sec(2, &p)].concat())
        };
        decode(&imports(998)).expect("998 imports of a 999-param function");
        assert_eq!(decode(&imports(999)).err(), Some(DecodeError::TypeSizeTooLarge));
        let at_import = last_decode_offset();
        let exports = |n: usize| {
            let mut p = leb(n);
            for i in 0..n {
                let name = i.to_string();
                p.extend([&leb(name.len()), name.as_bytes(), &[0x00, 0]].concat());
            }
            let ty = sec(1, &[&[1, 0x60][..], &leb(999), &[0x7f; 999], &[0]].concat());
            m(&[ty, sec(3, &[1, 0]), sec(7, &p), sec(10, &[1, 2, 0, 0x0b])].concat())
        };
        decode(&exports(998)).expect("998 exports of a 999-param function");
        assert_eq!(decode(&exports(999)).err(), Some(DecodeError::TypeSizeTooLarge));
        let at_export = last_decode_offset();
        assert_eq!((at_import, at_export), (Some(8894), Some(6902)), "wasm-tools' offsets");
        let memories = [&[100u8][..], &[0u8, 0].repeat(100)].concat();
        decode(&m(&sec(5, &memories))).expect("100 memories");
        decode(&m(&[t1, f1, code(&[&[1][..], &leb(49_999), &[0x7f, 0x0b]].concat())].concat()))
            .expect("one param and 49,999 locals");
    }

    /// Review I12 (owner, 2026-11-24: "lets match wasmtime and wasm-tools"): what was one
    /// `BadType` is five refusals in wasmtime's words. Each message and offset is what wasmtime 51 and
    /// wasm-tools 1.263 both reported for the same bytes. Supertype faults are judged once the rec group
    /// is read, at the group's start, so a fault in a LATER group is reported second.
    #[test]
    fn type_refusals_in_wasmtimes_words() {
        let ty_struct = [0x01, 0x03, 0x01, 0x5f, 0x00];
        let cases: [(&str, Vec<u8>, DecodeError, u32); 15] = [
            ("a bad leading byte", m(&[0x01, 0x04, 0x01, 0x99, 0x00, 0x00]), DecodeError::InvalidLeadingByte { byte: 0x99, what: "type" }, 11),
            ("a one-digit leading byte", m(&[0x01, 0x04, 0x01, 0x07, 0x00, 0x00]), DecodeError::InvalidLeadingByte { byte: 0x07, what: "type" }, 11),
            ("a bad byte after sub", m(&[0x01, 0x06, 0x01, 0x50, 0x00, 0x61, 0x00, 0x00]), DecodeError::InvalidLeadingByte { byte: 0x61, what: "type" }, 13),
            ("a bad byte after sub final", m(&[0x01, 0x06, 0x01, 0x4f, 0x00, 0x61, 0x00, 0x00]), DecodeError::InvalidLeadingByte { byte: 0x61, what: "type" }, 13),
            ("a bad byte in a rec group", m(&[0x01, 0x06, 0x01, 0x4e, 0x01, 0x61, 0x00, 0x00]), DecodeError::InvalidLeadingByte { byte: 0x61, what: "type" }, 13),
            ("two supertypes", m(&[0x01, 0x0b, 0x02, 0x50, 0x00, 0x5f, 0x00, 0x50, 0x02, 0x00, 0x00, 0x5f, 0x00]), DecodeError::MultipleSupertypes, 15),
            ("two supertypes, second in a rec group", m(&[0x01, 0x0d, 0x01, 0x4e, 0x02, 0x50, 0x00, 0x5f, 0x00, 0x50, 0x02, 0x00, 0x00, 0x5f, 0x00]), DecodeError::MultipleSupertypes, 11),
            ("itself as supertype", m(&[0x01, 0x07, 0x01, 0x50, 0x01, 0x00, 0x60, 0x00, 0x00]), DecodeError::SupertypeNotBefore, 11),
            ("a later type as supertype", m(&[0x01, 0x0a, 0x02, 0x50, 0x01, 0x01, 0x5f, 0x00, 0x50, 0x00, 0x5f, 0x00]), DecodeError::SupertypeNotBefore, 11),
            ("itself, second in a rec group", m(&[0x01, 0x0c, 0x01, 0x4e, 0x02, 0x50, 0x00, 0x5f, 0x00, 0x50, 0x01, 0x01, 0x5f, 0x00]), DecodeError::SupertypeNotBefore, 11),
            ("a supertype fault before a later group's bad byte", m(&[0x01, 0x07, 0x02, 0x50, 0x01, 0x00, 0x5f, 0x00, 0x99]), DecodeError::SupertypeNotBefore, 11),
            ("a function of a struct type", m(&[&ty_struct[..], &[0x03, 0x02, 0x01, 0x00, 0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b]].concat()), DecodeError::NotAFuncType(0), 16),
            ("an import of a struct type, at the import", m(&[&ty_struct[..], &[0x02, 0x07, 0x01, 0x01, 0x6d, 0x01, 0x66, 0x00, 0x00]].concat()), DecodeError::NotAFuncType(0), 16),
            ("a tag import of a struct type, at the import", m(&[&ty_struct[..], &[0x02, 0x08, 0x01, 0x01, 0x6d, 0x01, 0x66, 0x04, 0x00, 0x00]].concat()), DecodeError::NotAFuncType(0), 16),
            ("an import naming no type, at the import", m(&[0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x02, 0x07, 0x01, 0x01, 0x6d, 0x01, 0x66, 0x00, 0x05]), DecodeError::UnknownType(5), 17),
        ];
        for (name, bytes, err, at) in cases {
            assert_eq!(decode(&bytes).err(), Some(err), "{name}");
            assert_eq!(last_decode_offset(), Some(at), "{name}: wasmtime reports offset {at}");
        }
        assert_eq!(DecodeError::InvalidLeadingByte { byte: 0x07, what: "type" }.to_string(), "invalid leading byte (0x7) for type");
        assert_eq!(DecodeError::UnknownType(5).to_string(), "unknown type 5: type index out of bounds");
        // a supertype earlier in the same rec group is fine
        decode(&m(&[0x01, 0x0c, 0x01, 0x4e, 0x02, 0x50, 0x00, 0x5f, 0x00, 0x50, 0x01, 0x00, 0x5f, 0x00]))
            .expect("a supertype defined earlier in its rec group");
    }

    /// §5.5.12 spells an element segment's explicit type field **reftype**, not valtype — so a
    /// numeric type byte there is MALFORMED, and must be refused at DECODE.
    ///
    /// ⚠️ It was read as a valtype, so the module decoded and the complaint fell to the
    /// validator as a `TypeMismatch` — a different stage, and one that tells a caller the bytes
    /// were well-formed when they were not. **Rejection stage is part of correctness.**
    #[test]
    fn an_element_segments_type_field_must_be_a_reference_type() {
        // Element section, flags 5 (passive, const-expr form with an explicit type), then the
        // type byte, then one `ref.func 0` expression.
        let elem = |ty: u8| m(&[0x09, 0x07, 0x01, 0x05, ty, 0x01, 0xd2, 0x00, 0x0b]);
        // `0x7f` is i32 — not a reference type.
        assert_eq!(decode(&elem(0x7f)), Err(crate::types::DecodeError::BadRefType));
        // `0x70` is funcref, and must still decode — so this did not just start refusing the field.
        assert!(decode(&elem(0x70)).is_ok());
    }

    // --- §5.5.2 section structure: order, uniqueness, declared size (2026-08-08) ---

    /// A repeated section used to **silently replace** the first occurrence, because each arm
    /// assigns (`functions = decode_function_section(…)`). That is the silent-wrong-output class:
    /// the module that ran was not the module on disk.
    #[test]
    fn rejects_a_repeated_section() {
        let bytes = m(&[
            0x01, 0x04, 0x01, 0x60, 0x00, 0x00, // type
            0x03, 0x02, 0x01, 0x00, // function: 1 func
            0x03, 0x02, 0x01, 0x00, // function AGAIN
            0x0a, 0x07, 0x02, 0x02, 0x00, 0x0b, 0x02, 0x00, 0x0b, // code: 2 bodies
        ]);
        assert_eq!(decode(&bytes), Err(DecodeError::SectionOrder));
        // Mutation guard: without the repeat it decodes — but as ONE function against TWO bodies,
        // so it is then caught by the func/code count check rather than accepted.
        let one = m(&[
            0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
            0x03, 0x02, 0x01, 0x00,
            0x0a, 0x07, 0x02, 0x02, 0x00, 0x0b, 0x02, 0x00, 0x0b,
        ]);
        assert_eq!(decode(&one), Err(DecodeError::FuncCodeCountMismatch));
    }

    #[test]
    fn rejects_sections_out_of_order() {
        // Export (7) after code (10). Ordinary producers never emit this; a hostile one might.
        let bytes = m(&[
            0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
            0x03, 0x02, 0x01, 0x00,
            0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b,
            0x07, 0x05, 0x01, 0x01, b'f', 0x00, 0x00,
        ]);
        assert_eq!(decode(&bytes), Err(DecodeError::SectionOrder));
    }

    /// The order is **not** the id order, so this is the case a `>` on raw ids gets backwards:
    /// `DataCount` is id 12 yet must precede `Code` (id 10), and `Tag` is id 13 yet belongs
    /// between `Memory` and `Global`. Both are accepted here in their correct positions.
    #[test]
    fn accepts_data_count_before_code_and_tag_before_global() {
        let bytes = m(&[
            0x01, 0x04, 0x01, 0x60, 0x00, 0x00, // type (1)
            0x03, 0x02, 0x01, 0x00, // function (3)
            0x05, 0x03, 0x01, 0x00, 0x01, // memory (5)
            0x0d, 0x03, 0x01, 0x00, 0x00, // tag (13) — before global
            0x06, 0x06, 0x01, 0x7f, 0x00, 0x41, 0x00, 0x0b, // global (6)
            0x0c, 0x01, 0x01, // data count (12) — before code
            0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b, // code (10)
            0x0b, 0x07, 0x01, 0x00, 0x41, 0x00, 0x0b, 0x01, 0x2a, // data (11)
        ]);
        let md = decode(&bytes).expect("the canonical order must decode");
        assert_eq!(md.tags.len(), 1);
        assert_eq!(md.data.len(), 1);
        // And the same two, moved to where their raw ids would put them, are refused.
        let tag_last = m(&[
            0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
            0x06, 0x06, 0x01, 0x7f, 0x00, 0x41, 0x00, 0x0b, // global (6)
            0x0d, 0x03, 0x01, 0x00, 0x00, // tag (13) AFTER global — id order, wrong order
        ]);
        assert_eq!(decode(&tag_last), Err(DecodeError::SectionOrder));
    }

    /// Custom sections are exempt: any number, anywhere.
    #[test]
    fn custom_sections_may_repeat_and_appear_anywhere() {
        let bytes = m(&[
            0x00, 0x03, 0x02, b'h', b'i', // custom
            0x01, 0x04, 0x01, 0x60, 0x00, 0x00, // type
            0x00, 0x03, 0x02, b'h', b'i', // custom again, mid-module
            0x03, 0x02, 0x01, 0x00,
            0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b,
            0x00, 0x03, 0x02, b'h', b'i', // and after the last real section
        ]);
        assert!(decode(&bytes).is_ok());
    }

    /// A section that under-reads its declared size left the leftover bytes simply *absent* from
    /// the decoded module — the outer reader had already skipped them.
    #[test]
    fn rejects_a_section_whose_contents_are_shorter_than_its_declared_size() {
        // Type section declares size 5 but its contents occupy 4.
        let bytes = m(&[0x01, 0x05, 0x01, 0x60, 0x00, 0x00, 0x00]);
        assert_eq!(decode(&bytes), Err(DecodeError::SectionSizeMismatch));
        // The honest size decodes.
        assert!(decode(&m(&[0x01, 0x04, 0x01, 0x60, 0x00, 0x00])).is_ok());
    }

    #[test]
    fn rejects_function_code_count_mismatch_at_decode() {
        // A function section with no code section at all — malformed (§5.5.13), and previously
        // only caught one stage later by the validator.
        let bytes = m(&[0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x03, 0x02, 0x01, 0x00]);
        assert_eq!(decode(&bytes), Err(DecodeError::FunctionWithoutCode)); // wasmtime's own sentence for it
        // Neither section is fine: not every module has functions.
        assert!(decode(&m(&[0x01, 0x04, 0x01, 0x60, 0x00, 0x00])).is_ok());
    }

    /// A malformed *instruction encoding* is a decode error, not a validation one. Bodies used to
    /// be decoded lazily, so `decode` accepted these and the validator reported them — which is
    /// what `binary-leb128.wast` was measuring when it showed 15 wrong-stage rejections.
    #[test]
    fn rejects_a_malformed_body_encoding_at_decode() {
        // `i32.const` with an over-long LEB (unused bits set): malformed, not ill-typed.
        let bytes = m(&[
            0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
            0x03, 0x02, 0x01, 0x00,
            0x0a, 0x0b, 0x01, 0x09, 0x00, 0x41, 0x80, 0x80, 0x80, 0x80, 0x70, 0x1a, 0x0b,
        ]);
        assert_eq!(decode(&bytes), Err(DecodeError::LebOverflow { ty: "var_i32", too_long: false }));
    }

    /// The same rule for constant expressions, which are stored as raw bytes and were read by the
    /// validator and the interpreter with their own little readers.
    #[test]
    fn rejects_a_malformed_const_expr_encoding_at_decode() {
        // Global section: i32 immutable, `i32.const` with unused bits set.
        let bytes = m(&[0x06, 0x0a, 0x01, 0x7f, 0x00, 0x41, 0x80, 0x80, 0x80, 0x80, 0x70, 0x0b]);
        assert_eq!(decode(&bytes), Err(DecodeError::LebOverflow { ty: "var_i32", too_long: false }));
        // A well-formed one decodes.
        assert!(decode(&m(&[0x06, 0x06, 0x01, 0x7f, 0x00, 0x41, 0x00, 0x0b])).is_ok());
    }

    /// A **passive** data segment has no offset expression at all, so the const-expr sweep must key
    /// on the segment's mode. Keying on "is the byte string empty" instead would also excuse an
    /// *active* segment whose offset is genuinely missing. This test is why that distinction is in
    /// the code: written the sloppy way, it fails.
    #[test]
    fn a_passive_segment_has_no_offset_expression_to_check() {
        let bytes = m(&[
            0x01, 0x04, 0x01, 0x60, 0x00, 0x00, // type
            0x03, 0x02, 0x01, 0x00, // function
            0x05, 0x03, 0x01, 0x00, 0x01, // memory
            0x0c, 0x01, 0x01, // data count 1 — required by memory.init below
            // code: memory.init 0 0 with three zero operands
            0x0a, 0x0e, 0x01, 0x0c, 0x00, 0x41, 0x00, 0x41, 0x00, 0x41, 0x00, 0xfc, 0x08, 0x00,
            0x00, 0x0b,
            0x0b, 0x05, 0x01, 0x01, 0x02, b'h', b'i', // data: PASSIVE (flag 1), no offset expr
        ]);
        let md = decode(&bytes).expect("a passive segment must decode");
        assert!(!md.data[0].active);
        assert!(md.data[0].offset_expr.is_empty());
    }

    /// `memory.init` / `data.drop` need the data-count section: it is what lets their segment index
    /// be checked without having read the data section, so its absence is malformed (bulk-memory).
    #[test]
    fn rejects_a_bulk_data_op_with_no_data_count_section() {
        let body = [
            0x0a, 0x0e, 0x01, 0x0c, 0x00, 0x41, 0x00, 0x41, 0x00, 0x41, 0x00, 0xfc, 0x08, 0x00,
            0x00, 0x0b,
        ];
        let mut bytes = vec![
            0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
            0x03, 0x02, 0x01, 0x00,
            0x05, 0x03, 0x01, 0x00, 0x01,
        ];
        bytes.extend_from_slice(&body);
        bytes.extend_from_slice(&[0x0b, 0x05, 0x01, 0x01, 0x02, b'h', b'i']);
        assert_eq!(decode(&m(&bytes)), Err(DecodeError::DataCountRequired));
        // With the section present (id 12, before code) it decodes — see the test above.
    }

    #[test]
    fn decodes_empty_module() {
        let md = decode(&m(&[])).unwrap();
        assert_eq!(md.version, 1);
        assert_eq!(md.sections.len(), 0);
        assert_eq!(md.comp_types.len(), 0);
    }

    #[test]
    fn indexes_a_custom_section() {
        // custom: id 0, size 1, payload = name-length 0.
        let md = decode(&m(&[0x00, 0x01, 0x00])).unwrap();
        assert_eq!(md.sections.len(), 1);
        let s = md.section(SectionId::Custom).unwrap();
        assert_eq!(s.size, 1);
        assert_eq!(s.offset, 10);
    }

    #[test]
    fn names_must_be_valid_utf8() {
        // custom-section id = a lone continuation byte (0x80) — never valid UTF-8.
        assert_eq!(
            decode(&m(&[0x00, 0x02, 0x01, 0x80])),
            Err(DecodeError::InvalidUtf8)
        );
        // The same framing with a valid 1-byte name decodes.
        assert!(decode(&m(&[0x00, 0x02, 0x01, b'x'])).is_ok());
        // An EXPORT name that is a truncated 2-byte UTF-8 sequence is rejected.
        let bytes = m(&[
            0x01, 0x04, 0x01, 0x60, 0x00, 0x00, // type [] -> []
            0x03, 0x02, 0x01, 0x00, // function: one func of type 0
            0x07, 0x05, 0x01, 0x01, 0xC3, 0x00, 0x00, // export "\xC3" func 0
            0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b, // code: one empty body
        ]);
        assert_eq!(decode(&bytes), Err(DecodeError::InvalidUtf8));
    }

    #[test]
    fn rejects_bad_magic() {
        assert_eq!(
            decode(&[b'n', b'o', b'p', b'e', 0x01, 0x00, 0x00, 0x00]),
            Err(DecodeError::BadMagic)
        );
    }

    #[test]
    fn rejects_unsupported_version() {
        assert_eq!(
            decode(&[0x00, 0x61, 0x73, 0x6d, 0x02, 0x00, 0x00, 0x00]),
            Err(DecodeError::UnsupportedVersion(2))
        );
    }

    #[test]
    fn rejects_undefined_valtype() {
        // type section: one func type with a param byte 0x50 (not a valtype).
        let bytes = m(&[0x01, 0x05, 0x01, 0x60, 0x01, 0x50, 0x00]);
        assert_eq!(decode(&bytes), Err(DecodeError::BadValType));
    }

    #[test]
    fn rejects_reserved_global_mutability() {
        // global i32 with flags 0x04: only bits 0 (mutable) and 1 (shared) are defined.
        let bytes = m(&[0x06, 0x04, 0x01, 0x7f, 0x04, 0x0b]);
        assert_eq!(decode(&bytes), Err(DecodeError::MalformedFlag("malformed global flags")));
        // 0x02, a SHARED global, is shared-everything-threads — parsed by wasmtime, not implemented here.
        let shared = m(&[0x06, 0x04, 0x01, 0x7f, 0x02, 0x0b]);
        assert_eq!(decode(&shared), Err(DecodeError::UnimplementedProposal));
    }

    #[test]
    fn rejects_self_referential_supertype() {
        // one type = sub (0x50) with supertype [0] (itself), func [] -> [].
        let bytes = m(&[0x01, 0x07, 0x01, 0x50, 0x01, 0x00, 0x60, 0x00, 0x00]);
        assert_eq!(decode(&bytes), Err(DecodeError::SupertypeNotBefore));
    }

    #[test]
    fn decodes_type_import_function_export() {
        // (i32,i32)->i32 ; import env.add ; one defined func of type 0 ; export "run" func 1.
        let bytes = m(&[
            0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
            0x02, 0x0b, 0x01, 0x03, b'e', b'n', b'v', 0x03, b'a', b'd', b'd', 0x00, 0x00,
            0x03, 0x02, 0x01, 0x00,
            0x07, 0x07, 0x01, 0x03, b'r', b'u', b'n', 0x00, 0x01,
            // A code section is now REQUIRED alongside the function section (§5.5.13) — this
            // fixture omitted it, which the func/code count check correctly calls malformed.
            0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b,
        ]);
        let md = decode(&bytes).unwrap();
        assert_eq!(md.sections.len(), 5);
        assert_eq!(md.comp_types.len(), 1);
        assert_eq!(md.func_sig(0).unwrap().params, vec![ValType::I32, ValType::I32]);
        assert_eq!(md.func_sig(0).unwrap().results, vec![ValType::I32]);

        assert_eq!(md.imports.len(), 1);
        assert_eq!(md.imports[0].module, "env");
        assert_eq!(md.imports[0].name, "add");
        assert_eq!(md.imports[0].ty.kind(), ExternKind::Func);

        assert_eq!(md.functions, vec![0]);

        assert_eq!(md.exports.len(), 1);
        assert_eq!(md.exports[0].name, "run");
        assert_eq!(md.exports[0].index, 1);
        // export "run" resolves to the (i32,i32)->i32 signature of defined func 1.
        let Extern::Func(ft) = &md.exports[0].ty else {
            panic!("expected a func export");
        };
        assert_eq!(ft.results, vec![ValType::I32]);
        // and func_type resolves the same across the imports-then-defined index space.
        assert_eq!(md.func_type(1).unwrap().results, vec![ValType::I32]);
    }

    #[test]
    fn decodes_gc_struct_and_array() {
        // type section, 2 types: struct{(mut i32), i64}; array{(mut i8)}.
        let payload = [0x02, 0x5f, 0x02, 0x7f, 0x01, 0x7e, 0x00, 0x5e, 0x78, 0x01];
        let mut section = vec![0x01, payload.len() as u8];
        section.extend_from_slice(&payload);
        let md = decode(&m(&section)).unwrap();
        assert_eq!(md.comp_types.len(), 2);
        let st = md.struct_fields(0).unwrap();
        assert_eq!(st.len(), 2);
        assert_eq!(st[0].storage, StorageType::Val(ValType::I32));
        assert!(st[0].mutable);
        assert_eq!(st[1].storage, StorageType::Val(ValType::I64));
        assert!(!st[1].mutable);
        let arr = md.array_field(1).unwrap();
        assert_eq!(arr.storage, StorageType::I8);
        assert!(arr.mutable && arr.storage.is_packed());
        assert_eq!(arr.storage.unpacked(), ValType::I32);
    }

    #[test]
    fn gc_rec_group_forward_reference() {
        // (rec (struct (field (ref 1))) (struct (field i32)))
        let payload = [
            0x01, 0x4e, 0x02, 0x5f, 0x01, 0x64, 0x01, 0x00, 0x5f, 0x01, 0x7f, 0x00,
        ];
        let mut section = vec![0x01, payload.len() as u8];
        section.extend_from_slice(&payload);
        let md = decode(&m(&section)).unwrap();
        assert_eq!(md.comp_types.len(), 2);
        let StorageType::Val(f0) = md.struct_fields(0).unwrap()[0].storage else {
            panic!("expected a value-typed field");
        };
        assert!(f0.is_concrete() && f0.is_non_null_ref());
        assert_eq!(f0.concrete_index(), 1);
        assert_eq!(f0.ref_heap(), RefHeap::Struct);
        assert_eq!(
            md.struct_fields(1).unwrap()[0].storage,
            StorageType::Val(ValType::I32)
        );
    }

    #[test]
    fn decodes_code_section() {
        // (func (param i32 i32) (result i32) (local i32) local.get 0 local.get 1 i32.add)
        // Sections in the order §5.5.2 fixes — export (7) BEFORE code (10). This fixture had them
        // reversed until the section-order check was added and refused it.
        let bytes = m(&[
            0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f, // type
            0x03, 0x02, 0x01, 0x00, // function: 1 func of type 0
            0x07, 0x07, 0x01, 0x03, b'a', b'd', b'd', 0x00, 0x00, // export
            0x0a, 0x0b, 0x01, 0x09, 0x01, 0x01, 0x7f, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b, // code
        ]);
        let md = decode(&bytes).unwrap();
        assert_eq!(md.code.len(), 1);
        assert_eq!(md.code[0].locals.len(), 1);
        assert_eq!(md.code[0].locals[0].count, 1);
        assert_eq!(md.code[0].locals[0].ty, ValType::I32);
        assert_eq!(md.code[0].local_count(), 1);
        // The body is now stored decoded, so assert on the instructions rather than the bytes —
        // which is the stronger assertion anyway: it checks the decode, not just the slicing.
        assert_eq!(
            md.code[0].ir.iter().map(|i| i.op).collect::<Vec<_>>(),
            vec![
                crate::opcode::Op::LocalGet,
                crate::opcode::Op::LocalGet,
                crate::opcode::Op::I32Add,
                crate::opcode::Op::End,
            ]
        );
    }

    #[test]
    fn resolves_memory_export_with_limits() {
        // memory: count 1, flag 1 (has max), min 1, max 2; export "mem" memory 0.
        let bytes = m(&[
            0x05, 0x04, 0x01, 0x01, 0x01, 0x02,
            0x07, 0x07, 0x01, 0x03, b'm', b'e', b'm', 0x02, 0x00,
        ]);
        let md = decode(&bytes).unwrap();
        assert_eq!(md.exports.len(), 1);
        let Extern::Memory(mt) = &md.exports[0].ty else {
            panic!("expected a memory export");
        };
        assert_eq!(mt.limits.min, 1);
        assert_eq!(mt.limits.max, Some(2));
    }

    #[test]
    fn reads_function_names_from_name_section() {
        // custom "name": subsection 0 (module name, skipped) + subsection 1 (func names).
        let namemap = [0x02, 0x00, 0x02, b'h', b'i', 0x03, 0x03, b'b', b'y', b'e'];
        let mut payload = vec![0x00, 0x16, 0x04, b'n', b'a', b'm', b'e'];
        payload.extend_from_slice(&[0x00, 0x03, 0x02, b'm', b'd']); // subsection 0
        payload.extend_from_slice(&[0x01, 0x0a]); // subsection 1, size 10
        payload.extend_from_slice(&namemap);
        let md = decode(&m(&payload)).unwrap();
        assert_eq!(md.func_name(0), Some(&b"hi"[..]));
        assert_eq!(md.func_name(3), Some(&b"bye"[..]));
        assert_eq!(md.func_name(1), None); // gap in the vec
        assert_eq!(md.func_name(9), None); // past the end
    }

    #[test]
    fn malformed_name_section_is_not_an_error() {
        let m1 = decode(&m(&[])).unwrap();
        assert_eq!(m1.func_names, None);
        assert_eq!(m1.func_name(0), None);
        // A name section whose function subsection is truncated mid-entry must not fail.
        let truncated = m(&[
            0x00, 0x0b, 0x04, b'n', b'a', b'm', b'e', 0x01, 0x04, 0x02, 0x00, 0x05, b'h',
        ]);
        let m2 = decode(&truncated).unwrap();
        assert_eq!(m2.func_name(0), None);
    }

    /// custom-page-sizes, at the DECODER — each boundary as wasm-tools 1.259 draws it: an exponent
    /// that cannot be a size (`>= 64`) is malformed; one that can but is not 0/16 decodes (the
    /// validator refuses it); a TABLE has no such flag bit; and limits are u64 whatever the index
    /// type, so a 32-bit memory of 2^32 pages decodes and is refused as INVALID, not malformed.
    #[test]
    fn page_size_and_limits_are_decoded_as_wasm_tools_decodes_them() {
        let mem = |e: u8| m(&[0x05, 0x04, 0x01, 0x08, 0x00, e]);
        for e in [64u8, 65] {
            assert_eq!(decode(&mem(e)).unwrap_err(), DecodeError::InvalidPageSize, "exponent {e}");
        }
        for (e, valid) in [(0u8, true), (16, true), (1, false), (17, false), (63, false)] {
            let md = decode(&mem(e)).unwrap_or_else(|err| panic!("exponent {e} must decode: {err:?}"));
            assert_eq!(md.memories[0].page_size_log2, Some(u32::from(e)));
            assert_eq!(
                crate::validate::validate(&md).is_ok(),
                valid,
                "exponent {e}: only 0 and 16 are page sizes"
            );
        }
        // No flag, no page size — and 64 KiB is what that means.
        let plain = decode(&m(&[0x05, 0x03, 0x01, 0x00, 0x01])).unwrap();
        assert_eq!(plain.memories[0].page_size_log2, None);
        assert_eq!(plain.memories[0].page_size_log2(), 16);
        // A table's limits flag has no page-size bit.
        assert_eq!(
            decode(&m(&[0x04, 0x05, 0x01, 0x70, 0x08, 0x00, 0x00])).unwrap_err(),
            DecodeError::MalformedFlag("invalid table resizable limits flags")
        );
        // 2^32 pages on a 32-bit memory / 2^32 entries on a 32-bit table: decoded, then invalid.
        for bytes in [
            m(&[0x05, 0x07, 0x01, 0x00, 0x80, 0x80, 0x80, 0x80, 0x10]),
            m(&[0x04, 0x08, 0x01, 0x70, 0x00, 0x80, 0x80, 0x80, 0x80, 0x10]),
        ] {
            let md = decode(&bytes).expect("u64 limits must decode");
            assert_eq!(crate::validate::validate(&md), Err(crate::validate::ValidateError::InvalidLimits));
        }
    }

    /// The one ceiling rule, at its four corners (wasm-tools' own wording in the comments).
    #[test]
    fn max_pages_is_the_ceiling_at_every_corner() {
        assert_eq!(max_pages(false, 16), 0x1_0000); // "at most 0x10000 65536-byte pages"
        assert_eq!(max_pages(false, 0), 0xFFFF_FFFF); // "at most 0xffffffff 1-byte pages"
        assert_eq!(max_pages(true, 16), 0x1_0000_0000_0000);
        assert_eq!(max_pages(true, 0), u64::MAX);
    }

    /// custom-descriptors at the DECODER: the exact prefix `0x62` is meaningful ONLY after `0x63`/`0x64`
    /// (as a value type) or as a heap type, and names a CONCRETE type — each boundary as wasm-tools has it.
    #[test]
    fn the_exact_prefix_decodes_only_where_it_means_something() {
        // (struct (field (ref (exact 0)))) and its nullable twin.
        for (nn, prefix) in [(true, 0x64u8), (false, 0x63)] {
            let md = decode(&m(&[0x01, 0x07, 0x01, 0x5f, 0x01, prefix, 0x62, 0x00, 0x00])).unwrap();
            let CompType::Struct(fs) = &md.comp_types[0] else { panic!() };
            let StorageType::Val(v) = fs[0].storage else { panic!() };
            assert!(v.is_exact() && v.concrete_index() == 0 && v.is_non_null_ref() == nn, "{v:?}");
        }
        // A bare `0x62` is not a value type; a repeated prefix is not a type index.
        assert!(decode(&m(&[0x01, 0x06, 0x01, 0x5f, 0x01, 0x62, 0x00, 0x00])).is_err());
        assert!(decode(&m(&[0x01, 0x08, 0x01, 0x5f, 0x01, 0x64, 0x62, 0x62, 0x00, 0x00])).is_err());
        // An index beyond `MAX_CONCRETE_INDEX` is refused, not truncated into a smaller valid one.
        let over = crate::types::ValType::MAX_CONCRETE_INDEX + 1; // 2^27 — a 4-byte LEB
        let leb = [0x80, 0x80, 0x80, 0x40];
        assert_eq!(over, 1 << 27);
        let mut body = alloc::vec![0x01, 0x0a, 0x01, 0x5f, 0x01, 0x64, 0x62];
        body.extend_from_slice(&leb);
        body.push(0x00);
        assert_eq!(decode(&m(&body)).unwrap_err(), DecodeError::IndexOutOfRange);
    }

    /// Exactness is part of a value type's IDENTITY: `val_types_equal` — what `call_indirect`'s
    /// structural fallback asks — must not equate `(ref (exact $t))` with `(ref $t)`.
    #[test]
    fn val_types_equal_distinguishes_exactness() {
        let md = decode(&m(&[0x01, 0x03, 0x01, 0x5f, 0x00])).unwrap(); // (type (struct))
        let e = crate::types::ValType::exact_ref(false, crate::types::RefHeap::Struct, 0);
        let i = crate::types::ValType::concrete_ref(false, crate::types::RefHeap::Struct, 0);
        assert!(md.val_types_equal(e, e) && md.val_types_equal(i, i));
        assert!(!md.val_types_equal(e, i) && !md.val_types_equal(i, e));
    }
}
