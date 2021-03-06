public static int main (string[] args) {
	Sequence<string> seq = new Sequence<string> ();
	seq.append ("Lorem");
	seq.append ("ipsum");
	seq.append ("dolor");
	seq.append ("sit");
	seq.append ("amet");

	// Output:
	//  ``amet``
	//  ``sit``
	//  ``dolor``
	//  ``ipsum``
	//  ``Lorem``
	SequenceIter<string> iter = seq.get_end_iter ().prev ();
	bool has_next = !iter.is_begin ();
	while (has_next) {
		print ("%d: %s\n", iter.get_position (), iter.get ());
		has_next = !iter.is_begin ();
		iter = iter.prev ();
	}

	return 0;
}
