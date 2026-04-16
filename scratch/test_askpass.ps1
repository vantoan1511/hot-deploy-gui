$password = "test_password"
$env:SSH_ASKPASS_REQUIRE = "force"
# Create a temporary batch file that echoes the password
$askpass_script = Join-Path $PWD "askpass.bat"
"@echo $password" | Out-File -FilePath $askpass_script -Encoding ASCII

$env:SSH_ASKPASS = $askpass_script
$env:DISPLAY = "dummydisplay:0"

# Try ssh to localhost to see if it even attempts to use askpass
# We use -v to see debug output
ssh -v -o StrictHostKeyChecking=no dummy@localhost exit 2>&1 | Select-Object -First 50

Remove-Item $askpass_script
