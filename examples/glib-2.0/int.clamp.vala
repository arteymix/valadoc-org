public static int main (string[] args) {
	// Output: ``10``
	int i = 5.clamp (10, 15);
	print ("%d\n", i);

	// Output: ``10``
	i = 15.clamp (5, 10);
	print ("%d\n", i);

	// Output: ``20``
	i = 20.clamp (15, 25);
	print ("%d\n", i);

	return 0;
}
