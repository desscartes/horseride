from pathlib import Path
import json,datetime,faulthandler,subprocess,glob,time
root=Path('D:/Apps/HorseRide');log=(root/'data/maintenance/weekly-gpu-stack.log').open('a')
faulthandler.enable(file=log);faulthandler.dump_traceback_later(30,repeat=True,file=log)
print('python_started',flush=True)
# Trace original DLL enumeration without changing loading flags/security checks.
original_glob=glob.glob
class TracedDllList(list):
 def __iter__(self):
  for name in super().__iter__():
   started=time.monotonic();print('loading_dll',Path(name).name,flush=True)
   yield name
   print('loaded_dll',Path(name).name,round(time.monotonic()-started,2),flush=True)
def trace_glob(pattern,*args,**kwargs):
 result=original_glob(pattern,*args,**kwargs)
 return TracedDllList(result) if 'torch' in str(pattern).lower() and str(pattern).endswith('*.dll') else result
glob.glob=trace_glob
import torch
glob.glob=original_glob
print('torch_imported',torch.__version__,flush=True)
available=torch.cuda.is_available();print('cuda_available',available,flush=True)
if not available:raise RuntimeError('CUDA is unavailable for this Windows task account')
x=torch.tensor([2.0],device='cuda');assert (x*x).item()==4
identity=subprocess.check_output(['whoami','/user','/fo','csv','/nh'],creationflags=subprocess.CREATE_NO_WINDOW).decode(errors='replace')
(root/'data/maintenance/weekly-video-gpu-probe.json').write_text(json.dumps({'status':'passed','device':torch.cuda.get_device_name(0),'systemAccount':'S-1-5-18' in identity,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'codexRequired':False}),encoding='utf-8')
faulthandler.cancel_dump_traceback_later();print('gpu_calculation_passed',flush=True)
