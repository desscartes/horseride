Option Explicit
Dim shell, args
Set shell = CreateObject("Shell.Application")
args = "-NoProfile -ExecutionPolicy Bypass -File ""D:\Apps\HorseRide\server\repair-weekly-video-task.ps1"""
On Error Resume Next
shell.ShellExecute "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe", args, "D:\Apps\HorseRide", "runas", 0
If Err.Number <> 0 Then
 MsgBox "Windows yonetici onayi tamamlanmadi. Kurulum yapilmadi. Bilgisayar yeniden baslatilmaz.", vbInformation, "HorseRide haftalik video kurulumu"
End If
