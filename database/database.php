<?php

//
// Variables
//

$db_host = "localhost";
$db_name = "vala";
$db_user = "vala";
$db_pass = null;

//
// Functions
//

function create_table ($name) {
	global $db;

	$query_string = "CREATE TABLE IF NOT EXISTS `$name` (
		`name` VARCHAR(100) NOT NULL,
		`type` VARCHAR(100),
		`shortdesc` VARCHAR(100),
		`path` VARCHAR(100),
		`signature` VARCHAR(100),
		PRIMARY KEY (`name`)
	);";

	$query = $db->prepare($query_string);

	return $query->execute();
}

function drop_table ($name) {
	global $db;

	$query_string = "DROP TABLE IF EXISTS `$name`;";
	$query = $db->prepare($query_string);

	return $query->execute();
}

function create_row ($name, $doc) {
	global $db;

	$query_string = "INSERT IGNORE INTO `$name` (";

	foreach ($doc as $field => $data) {
		$query_string .= "$field,";
	}

	$query_string = rtrim($query_string, ",").") VALUES (";

	foreach ($doc as $field => $data) {
		$query_string .= "'$data',";
	}

	$query_string = rtrim($query_string, ",").");";

	$query = $db->prepare($query_string);

	return $query->execute();
}

//
// Setup
//

try {
	$db = new PDO("mysql:host=$db_host;dbname=$db_name", $db_user, $db_pass);
} catch (Exception $e) {
	error_log("Unable to connect to database");
	error_log($e);
	exit(1);
}

// Grab command line comments for easy access
$args = getopt("fv", ["force", "verbose"]);
$args["force"] = (isset($args["f"]) || isset($args["force"]));
$args["verbose"] = (isset($args["v"]) || isset($args["verbose"]));

// Setup stats so we have something to exit with
$stats = [
	"package" => 0,
	"namespace" => 0,
	"class" => 0,
	"error" => 0
];

//
// Per tag functions for creating database objects
//
function build_namespace(SimpleXmlElement $node, $package) {
	global $args;
	global $stats;

	$namespace = $node->attributes()->id;

	$r = create_row($package, [
		"name" => $node->attributes()->name,
		"type" => "NAMESPACE",
		"path" => $package . "/" . $namespace
	]);

	if (!$r && $args["verbose"]) {
		printf("Unable to create $namespace namespace.\n");
		$stats["error"] += 1;
	}

	if ($r) $stats["namespace"] += 1;
	build_next($node, $package);
}


function build_class(SimpleXMLElement $node, $package) {
	global $args;
	global $stats;

	$attr = $node->attributes();
	$id = $attr->id;

	$r = create_row($package, [
		"name" => $id,
		"type" => "CLASS",
		"path" => $package . "/" . $id
	]);

	if (!$r && $args["verbose"]) {
		printf("Unable to create $id class.\n");
		$stats["error"] += 1;
	}

	if ($r) $stats["class"] += 1;
	build_next($node, $package);
}

function build_item(SimpleXMLElement $node, $type, $package) {
	global $args;
	global $stats;

	$attr = $node->attributes();
	$id = $attr->id;

	$r = create_row($package, [
		"name" => $id,
		"type" => strtoupper($type),
		"path" => $package . "/" . $id
	]);

	if (!$r && $args["verbose"]) {
		printf("Unable to create $id $type.\n");
		$stats["error"] += 1;
	}

	if ($r) $stats[$type] += 1;
	build_next($node, $package);
}

//
// Director function for iterating over the unknown
//
function build_next(SimpleXMLElement $node, $package) {
	if (isset($node->namespace)) {
		foreach ($node->namespace as $namespace) {
			build_namespace($namespace, $package);
		}
	}

	if (!isset($node->members) && !array_key_exists("memebers", $node)) return;

	if (isset($node->members->class) || array_key_exists("class", $node->members)) {
		foreach ($node->members->class as $class) {
			build_class($class, $package);
		}
	}

	if (isset($node->members->method) || array_key_exists("method", $node->members)) {
		foreach ($node->members->method as $method) {
			build_item($method, "method", $package);
		}
	}

	if (isset($node->members->property) || array_key_exists("property", $node->members)) {
		foreach ($node->members->property as $property) {
			build_item($property, "property", $package);
		}
	}

	if (isset($node->members->signal) || array_key_exists("signal", $node->members)) {
		foreach ($node->members->signal as $signal) {
			build_item($signal, "signal", $package);
		}
	}
}

//
// Start building the rows
//
$files = array_diff(scandir(__DIR__ . "/docs"), ["..", "."]);

foreach ($files as $packagefile) {
	try {
		if (!$args["verbose"]) {
			libxml_clear_errors();
			libxml_use_internal_errors(true);
		}

		$xml = simplexml_load_file(__DIR__ . "/docs/" . $packagefile);
	} catch (Exception $e) {
		printf("Unable to open $packagefile. Continuing to next package file\n");
		$stats["error"] += 1;
		continue;
	}

	if ($xml === false) {
		printf("Unable to open $packagefile. Continuing to next package file\n");
		$stats["error"] += 1;
		continue;
	}

	$package = $xml->attributes()->name;

	if ($args["force"]) {
		$r = drop_table($package);

		if (!$r) {
			printf("Unable to drop $package table.\n");
			$stats["error"] += 1;
		}
	}

	$r = create_table($package);

	if (!$r) {
		printf("Unable to create $package table.\n");
		$stats["error"] += 1;
		continue;
	}

	$stats["package"] += 1;
	build_next($xml, $package);
}

//
// Report card time
//
printf("database.php complete!\n");

if ($args["verbose"]) {
	printf("database updates:\n");

	foreach ($stats as $name => $value) {
		printf("$name => $value\n");
	}
}

exit(0);
