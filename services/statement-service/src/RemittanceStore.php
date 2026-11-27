<?php

declare(strict_types=1);

namespace Helios\StatementService;

/**
 * Minimal on-disk store for imported remittance advices. Keeps the service a
 * real capability: partners upload a remittance CSV, the service parses the
 * line items and can list them back.
 */
final class RemittanceStore
{
    private string $dataDir;

    public function __construct(?string $dataDir = null)
    {
        $this->dataDir = $dataDir ?? (getenv('STATEMENT_DATA_DIR') ?: __DIR__ . '/../data');

        if (!is_dir($this->dataDir)) {
            mkdir($this->dataDir, 0o775, true);
        }
    }

    /**
     * Parse a remittance advice CSV body and persist a summary record.
     *
     * Expected columns: invoiceRef,amountCents,currency,paidOn
     */
    public function importCsv(string $partnerRef, string $csvBody): array
    {
        $lineItems = [];
        $totalCents = 0;

        $rows = preg_split('/\r\n|\r|\n/', trim($csvBody)) ?: [];
        foreach ($rows as $index => $row) {
            if ($row === '' || ($index === 0 && stripos($row, 'invoiceRef') !== false)) {
                continue;
            }

            $cols = str_getcsv($row, ',', '"', '');
            if (count($cols) < 2) {
                continue;
            }

            $amountCents = (int) trim($cols[1]);
            $totalCents += $amountCents;
            $lineItems[] = [
                'invoiceRef' => trim($cols[0]),
                'amountCents' => $amountCents,
                'currency' => isset($cols[2]) ? trim($cols[2]) : 'USD',
                'paidOn' => isset($cols[3]) ? trim($cols[3]) : null,
            ];
        }

        $record = [
            'id' => bin2hex(random_bytes(8)),
            'partnerRef' => $partnerRef,
            'importedAt' => gmdate('c'),
            'lineItemCount' => count($lineItems),
            'totalCents' => $totalCents,
            'lineItems' => $lineItems,
        ];

        file_put_contents(
            $this->dataDir . '/' . $record['id'] . '.json',
            json_encode($record, JSON_PRETTY_PRINT)
        );

        return $record;
    }

    public function list(): array
    {
        $summaries = [];

        foreach (glob($this->dataDir . '/*.json') ?: [] as $path) {
            $record = json_decode((string) file_get_contents($path), true);
            if (!is_array($record)) {
                continue;
            }

            unset($record['lineItems']);
            $summaries[] = $record;
        }

        usort($summaries, static fn ($a, $b) => strcmp($b['importedAt'] ?? '', $a['importedAt'] ?? ''));

        return $summaries;
    }
}
