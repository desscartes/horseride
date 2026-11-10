# DAILY_HISTORY_DISPATCH: bounded background worker, own OS lock, resumes after restart.
if((Test-Path 'D:\Apps\HorseRide\data\instagram\daily-history-policy.json') -and (Get-Content 'D:\Apps\HorseRide\data\instagram\daily-history-policy.json' -Raw|ConvertFrom-Json).enabled){
 try { & 'D:\Apps\HorseRide\server\dispatch-daily-history.ps1' } catch { Write-Output 'Daily history dispatch failed; inspect the persistent local alarm.' }
}
$ErrorActionPreference='Stop'
# PUBLICATION_DELIVERY_WATCHDOG: fixed existing tasks only; no direct publication, no visual auto-approval.
try { & 'D:\Tools\node-v24.15.0-win-x64\node.exe' 'D:\Apps\HorseRide\server\publication-watchdog.mjs' '--context=commentary-windows-task' *> 'D:\Apps\HorseRide\data\maintenance\publication-watchdog-commentary-windows-task.log' } catch { Write-Output 'Publication delivery audit failed; inspect local alarm.' }
# LOCAL_OPERATIONS_AUDIT: existing five-minute Windows task, no Codex or external calls.
& 'D:\Tools\node-v24.15.0-win-x64\node.exe' 'D:\Apps\HorseRide\server\local-operations-audit.mjs' *> 'D:\Apps\HorseRide\data\maintenance\local-operations-audit-task.log'
# LOCAL_VIDEO_DRAFT_QUEUE: bounded dispatch only; never approves or publishes a video.
& 'D:\Tools\node-v24.15.0-win-x64\node.exe' 'D:\Apps\HorseRide\server\video-production-queue.mjs' *> 'D:\Apps\HorseRide\data\maintenance\video-production-queue-task.log'
# GAZI_LOCAL_PREVIEW_ASSEMBLY: bounded local preview only, never approves or publishes.
try { & 'D:\Apps\HorseRide\.venv\Scripts\python.exe' 'D:\Apps\HorseRide\server\assemble-gazi-hybrid-preview.py' *> 'D:\Apps\HorseRide\data\maintenance\gazi-local-preview-assembly.log' } catch { Write-Output 'Gazi preview assembly requires attention.' }
# HISTORY_CONTEXT_AGENT: local source/timeline audit and generation/documentary route selection.
try { & 'D:\Apps\HorseRide\.venv\Scripts\python.exe' 'D:\Apps\HorseRide\server\history-context-agent.py' '--scan' *> 'D:\Apps\HorseRide\data\maintenance\history-context-agent-task.log' } catch { Write-Output 'History context agent requires attention; publication remains gated.' }
# HISTORY_PRODUCTION_CONTROLLER: local documentary fallback for prepared source-reviewed story packages. Preview only.
try { & 'D:\Apps\HorseRide\.venv\Scripts\python.exe' 'D:\Apps\HorseRide\server\history-production-controller.py' *> 'D:\Apps\HorseRide\data\maintenance\history-production-controller-task.log' } catch { Write-Output 'Historical production needs attention; never substitute generic filler.' }
# LOCAL_VIDEO_REVIEW_AGENT: offline audit, one changed film per invocation, OS lock prevents overlap.
try { & 'D:\Apps\HorseRide\.venv\Scripts\python.exe' 'D:\Apps\HorseRide\server\local-video-review.py' '--scan' *> 'D:\Apps\HorseRide\data\maintenance\local-video-review-task.log' } catch { Write-Output 'Local video audit failed; final publication gate remains closed.' }
# Audit warnings never prevent commentary preparation.
$job=Start-Process -FilePath 'D:\Tools\node-v24.15.0-win-x64\node.exe' -ArgumentList '--use-system-ca','D:\Apps\HorseRide\server\run-commentary-watchdog.mjs' -WorkingDirectory 'D:\Apps\HorseRide' -WindowStyle Hidden -RedirectStandardOutput 'D:\Apps\HorseRide\data\maintenance\commentary-watchdog.log' -RedirectStandardError 'D:\Apps\HorseRide\data\maintenance\commentary-watchdog-error.log' -PassThru
try{$job.PriorityClass='BelowNormal'}catch{}
$job.WaitForExit()
$commentaryExit=$job.ExitCode
$coupons=Start-Process 'D:\Tools\node-v24.15.0-win-x64\node.exe' -ArgumentList '--use-system-ca','server/run-coupon-watchdog.mjs' -WorkingDirectory 'D:\Apps\HorseRide' -WindowStyle Hidden -RedirectStandardOutput 'D:\Apps\HorseRide\data\maintenance\coupon-watchdog.log' -RedirectStandardError 'D:\Apps\HorseRide\data\maintenance\coupon-watchdog-error.log' -PassThru
try{$coupons.PriorityClass='BelowNormal'}catch{}
$coupons.WaitForExit()
exit $commentaryExit
