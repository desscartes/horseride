import os,argparse,json,hashlib
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1';os.environ['OMP_NUM_THREADS']='2'
import torch
from diffusers import StableDiffusionPipeline
from PIL import ImageOps
p=argparse.ArgumentParser();p.add_argument('--prompt-file',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--seed',type=int,required=True);a=p.parse_args()
root=Path('D:/Apps/HorseRide/video-runtime')
configuration=Path('D:/Apps/HorseRide/data/maintenance/video-runtime-config.json')
if configuration.exists():
 config=json.loads(configuration.read_text(encoding='utf-8-sig'))
 if config.get('enabled'):
  candidate=Path(config['path']).resolve()
  assert candidate in (root.resolve(),Path('C:/Users/desscartes/AppData/Local/HorseRide/video-runtime').resolve(),Path('C:/Users/desscartes/HorseRideVideoRuntime').resolve())
  assert json.loads((candidate/'cache-marker.json').read_text(encoding='utf-8-sig'))['status']=='verified'
  root=candidate
a.output.resolve().relative_to(root)
assert (root/'sd15/verified-model.json').exists()
torch.set_num_threads(2)
pipe=StableDiffusionPipeline.from_pretrained(str(root/'sd15'),variant='fp16',torch_dtype=torch.float16,local_files_only=True,use_safetensors=True)
pipe.enable_attention_slicing('max');pipe.enable_vae_slicing();pipe.enable_model_cpu_offload()
prompt=a.prompt_file.read_text(encoding='utf-8-sig')
result=pipe(prompt,num_inference_steps=28,guidance_scale=7,width=512,height=768,
 negative_prompt='text, letters, watermark, logo, deformed anatomy, extra limbs, fused legs, full body horse, galloping horse, close human face, modern cars, smartphones, fantasy monsters, nudity',
 generator=torch.Generator(device='cpu').manual_seed(a.seed))
if result.nsfw_content_detected and any(result.nsfw_content_detected):raise RuntimeError('Frame rejected by image safety checker')
image=ImageOps.fit(result.images[0].convert('RGB'),(288,512))
import numpy as np
pixels=np.asarray(image)
if pixels.max()<10 or pixels.std()<2:raise RuntimeError('Frame is black or visually empty')
a.output.parent.mkdir(parents=True,exist_ok=True);image.save(a.output)
a.output.with_suffix('.json').write_text(json.dumps({'seed':a.seed,'prompt':prompt,'sha256':hashlib.sha256(a.output.read_bytes()).hexdigest(),'model':'SD1.5 pinned safetensors','requiresVisualReview':True,'historicalArchive':False}),encoding='utf-8')
print('Original first frame generated locally; visual review required.')
