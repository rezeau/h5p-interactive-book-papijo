<?php
// Storage fixture only. The installed H5P validator and core execute unchanged.
// AdvancedText 1.3 is registered in memory using unchanged 1.2.6 semantics.
error_reporting(E_ALL & ~E_DEPRECATED);
set_error_handler(function ($severity, $message, $file, $line) {
    if (error_reporting() & $severity) {
        throw new ErrorException($message, 0, $severity, $file, $line);
    }
});
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
require_once $input['corePath'];

final class InteractiveBookFixtureStorage {
    public $errors = [];
    public $libraries;
    public $semantics;
    public $libraryRoots;

    public function t($message, $arguments = []) {
        return strtr($message, $arguments);
    }

    public function setErrorMessage($message, $code = null) {
        $this->errors[] = ['message' => $message, 'code' => $code];
    }

    public function loadLibrary($name, $major, $minor) {
        $key = "$name $major.$minor";
        if (isset($this->libraries[$key])) {
            return $this->libraries[$key];
        }
        foreach ($this->libraryRoots as $root) {
            $file = "$root/$name-$major.$minor/library.json";
            if (is_file($file)) {
                $library = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
                if ([$library['machineName'], $library['majorVersion'], $library['minorVersion']]
                    === [$name, $major, $minor]) {
                    return $library;
                }
            }
        }
        return null;
    }

    public function loadLibrarySemantics($name, $major, $minor) {
        return $this->semantics["$name $major.$minor"] ?? null;
    }

    public function alterLibrarySemantics(&$semantics, $name, $major, $minor) {
        // Keep every registered library's real semantics intact.
    }
}

function validateFixture($input, $old, $nested) {
    $storage = new InteractiveBookFixtureStorage();
    $book = $input[$old ? 'oldBookLibrary' : 'bookLibrary'];
    $bookSemantics = $input[$old ? 'oldBookSemantics' : 'bookSemantics'];
    $bookKey = $book['machineName'] . ' ' . $book['majorVersion'] . '.' . $book['minorVersion'];
    $storage->libraries = [$bookKey => $book, 'H5P.ColumnPapiJo 1.21' => $input['columnLibrary']];
    if ($old) {
        // Actual historical manifest, so the old book's preload stays 1.20.
        $storage->libraries['H5P.ColumnPapiJo 1.20'] = $input['oldColumnLibrary'];
    }
    $storage->semantics = [
        $bookKey => json_encode($bookSemantics, JSON_THROW_ON_ERROR),
        'H5P.ColumnPapiJo 1.21' => json_encode($input['columnSemantics'], JSON_THROW_ON_ERROR)
    ];
    if ($nested) {
        $child = $input['childLibrary'];
        if ([$child['machineName'], $child['majorVersion'], $child['minorVersion'], $child['patchVersion']]
            !== ['H5P.AdvancedTextPapiJo', 1, 2, 6]) {
            throw new RuntimeException('Prospective registration requires unchanged AdvancedTextPapiJo 1.2.6 sources.');
        }
        $child['minorVersion'] = 3;
        $child['patchVersion'] = 0;
        $storage->libraries['H5P.AdvancedTextPapiJo 1.3'] = $child;
        $storage->semantics['H5P.AdvancedTextPapiJo 1.3'] = json_encode($input['childSemantics'], JSON_THROW_ON_ERROR);
    }
    $storage->libraryRoots = $input['libraryRoots'];
    $core = (new ReflectionClass(H5PCore::class))->newInstanceWithoutConstructor();
    (new ReflectionProperty(H5PCore::class, 'h5pF'))->setValue($core, $storage);
    $validator = new H5PContentValidator($storage, $core);
    $content = json_decode(json_encode($input['content'], JSON_THROW_ON_ERROR));
    $content->library = $bookKey;
    if (!$nested) {
        $content->params->chapters[0]->params->content = [];
    }
    $validator->validateLibrary($content, (object) ['options' => [$bookKey]]);
    $dependencies = [];
    foreach ($validator->getDependencies() as $dependency) {
        $library = $dependency['library'];
        $dependencies[] = [
            'machineName' => $library['machineName'],
            'majorVersion' => $library['majorVersion'],
            'minorVersion' => $library['minorVersion'],
            'type' => $dependency['type']
        ];
    }
    $errors = $storage->errors;
    // Check the actual page field separately to expose its rejection as null.
    foreach ($bookSemantics as $field) {
        if ($field['name'] === 'chapters') {
            $pageField = $field['field']['fields'][0];
        }
    }
    $page = json_decode(json_encode($input['content']['params']['chapters'][0], JSON_THROW_ON_ERROR));
    if (!$nested) {
        $page->params->content = [];
    }
    $validator->validateLibrary($page, (object) $pageField);
    return ['content' => $content, 'directPage' => $page, 'dependencies' => $dependencies, 'errors' => $errors];
}

$result = [
    'columnOnly' => validateFixture($input, false, false),
    'old' => validateFixture($input, true, false),
    'validatorPath' => (new ReflectionClass(H5PContentValidator::class))->getFileName(),
    'dependencyTraversalPath' => (new ReflectionMethod(H5PCore::class, 'findLibraryDependencies'))->getFileName()
];
if (isset($input['childLibrary'])) {
    $result['nested'] = validateFixture($input, false, true);
    $result['sourceChildVersion'] = '1.2.6';
    $result['registrationOnlyVersion'] = '1.3.0';
}
echo json_encode($result, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT);
