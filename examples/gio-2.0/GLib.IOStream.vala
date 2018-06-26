public static int main (string[] args) {
	try {
		// Create a file that can only be accessed by the current user:
		File file = File.new_for_path ("my-test.bin");
		IOStream ios = file.create_readwrite (FileCreateFlags.PRIVATE);


		//
		// Write data:
		//

		size_t bytes_written;
		OutputStream os = ios.output_stream;
		os.write_all ("My 1. line\n".data, out bytes_written);
		os.write_all ("My 2. line\n".data, out bytes_written);

		DataOutputStream dos = new DataOutputStream (os);
		dos.put_string ("My 3. line\n");
		dos.put_int16 (10);
		ios = null;


		// Open the file for reading:
		InputStream @is = file.read ();


		//
		// Read n bytes:
		//

		// Output: ``M``
		uint8 buffer[1];
		size_t size = @is.read (buffer);
		stdout.write (buffer, size);

		// Output: ``y 1. line``
		DataInputStream dis = new DataInputStream (@is);
		string str = dis.read_line ();
		print ("%s\n", str);

		// Output: ``My 2. line``
		str = dis.read_line ();
		print ("%s\n", str);

		// Output: ``My 3. line``
		str = dis.read_line ();
		print ("%s\n", str);

		// Output: ``10``
		int16 i = dis.read_int16 ();
		print ("%d\n", i);
	} catch (Error e) {
		print ("Error: %s\n", e.message);
	}

	return 0;
}
