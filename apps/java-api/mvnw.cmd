@echo off
setlocal
set "MVNW_DIR=%~dp0"
set "MVNW_VERSION=3.9.11"
set "MVNW_HOME=%MVNW_DIR%.mvn\apache-maven-%MVNW_VERSION%"
if not exist "%MVNW_HOME%\bin\mvn.cmd" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $zip=Join-Path $env:TEMP 'apache-maven-3.9.11-bin.zip'; Invoke-WebRequest -UseBasicParsing 'https://archive.apache.org/dist/maven/maven-3/3.9.11/binaries/apache-maven-3.9.11-bin.zip' -OutFile $zip; Expand-Archive -LiteralPath $zip -DestinationPath '%MVNW_DIR%.mvn' -Force"
  if errorlevel 1 exit /b 1
)
call "%MVNW_HOME%\bin\mvn.cmd" %*

