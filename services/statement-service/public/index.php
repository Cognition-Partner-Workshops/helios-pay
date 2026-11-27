<?php

declare(strict_types=1);

require __DIR__ . '/../src/Version.php';
require __DIR__ . '/../src/RemittanceStore.php';

use Helios\StatementService\RemittanceStore;
use Helios\StatementService\Version;

/*
 * Helios Pay — Remittance Statement service.
 *
 * A PHP/Apache (mod_php) microservice that lets partners upload remittance
 * advice files through a multipart (RFC1867) upload endpoint.
 */

function sendJson(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($payload, JSON_PRETTY_PRINT);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($method === 'GET' && $path === '/healthz') {
    sendJson(200, ['status' => 'ok']);
    return;
}

if ($method === 'GET' && ($path === '/' || $path === '/version')) {
    // Runtime version report used by the runtime validation harness.
    sendJson(200, [
        'service' => 'statement-service',
        'sapi' => PHP_SAPI,
        'runtime' => Version::report(),
    ]);
    return;
}

if ($method === 'GET' && $path === '/remittances') {
    sendJson(200, ['remittances' => (new RemittanceStore())->list()]);
    return;
}

if ($method === 'POST' && $path === '/remittances/import') {
    $partnerRef = $_POST['partnerRef'] ?? 'unknown-partner';

    if (!isset($_FILES['remittance']) || ($_FILES['remittance']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        sendJson(400, ['error' => 'remittance file upload is required']);
        return;
    }

    $csvBody = (string) file_get_contents($_FILES['remittance']['tmp_name']);
    $record = (new RemittanceStore())->importCsv((string) $partnerRef, $csvBody);

    // Sentinel the runtime-validation harness checks for: it proves application
    // code ran.
    sendJson(201, ['imported' => true, 'remittance' => $record]);
    return;
}

sendJson(404, ['error' => 'not found', 'path' => $path]);
