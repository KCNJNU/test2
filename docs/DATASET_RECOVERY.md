# Dataset-version recovery

Published dataset versions are restored from their Git tag and the dedicated DVC
remote. The raw-object bucket (`robot-raw-files`) is not a DVC remote; development
uses the separate `robot-dvc-store` bucket.

## Prerequisites

- Git and DVC installed, including DVC's S3 support.
- Credentials that can read the configured `robot-dvc-store` DVC remote.
- A clone URL and the published tag (for example `dataset-nightly-scan-v1.0.0`).

## Empty-directory recovery

```sh
git clone <repository-url> restored-dataset
cd restored-dataset
git checkout dataset-<datasetName>-v<version>.0.0
dvc pull data/dataset-workspace/<datasetName>/<version>.dvc
```

Validate every restored payload against the co-located manifest. In PowerShell:

```powershell
$dataset = 'data/dataset-workspace/<datasetName>/<version>'
$manifest = Get-Content -Raw "$dataset/manifest.json" | ConvertFrom-Json
foreach ($file in $manifest.files) {
  $path = Get-ChildItem "$dataset/files/$($file.fileId).*" | Select-Object -First 1
  if ((Get-FileHash -LiteralPath $path.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.checksum) { throw "Checksum mismatch: $($file.fileId)" }
}
```

The `.dvc/config` saved by publication identifies the remote by name and bucket.
Provide credentials through the normal DVC/AWS environment variables or local
DVC configuration; do not put secrets in Git.
