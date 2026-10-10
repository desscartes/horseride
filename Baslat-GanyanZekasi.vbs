Set shell = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
projectRoot = fs.GetParentFolderName(WScript.ScriptFullName)
nodePath = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not fs.FileExists(nodePath) Then
  nodePath = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
End If
If Not fs.FileExists(nodePath) Then
  fs.CreateTextFile(projectRoot & "\service-start-error.log", True).WriteLine "Node.js 24 gerekli; calistirilabilir dosya bulunamadi."
  WScript.Quit 1
End If
shell.CurrentDirectory = projectRoot
result = shell.Run(Chr(34) & nodePath & Chr(34) & " --use-system-ca " & Chr(34) & projectRoot & "\server\service-supervisor.mjs" & Chr(34), 0, True)
WScript.Quit result
