(module (rec (type $a (descriptor $b) (struct)) (type $b (describes $a) (struct)))
     (func $f (param $r (ref null (exact $a)))))
