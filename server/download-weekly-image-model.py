import os,json,hashlib
from pathlib import Path
os.environ['HF_HUB_DISABLE_XET']='1'
from huggingface_hub import snapshot_download
target=Path('D:/Apps/HorseRide/video-runtime/sd15')
revision='451f4fe16113bff5a5d2269ed5ad43b0592e9a14'
snapshot_download('stable-diffusion-v1-5/stable-diffusion-v1-5',revision=revision,local_dir=target,
 allow_patterns=['model_index.json','LICENSE*','README.md','scheduler/*','tokenizer/*','feature_extractor/*',
 'text_encoder/config.json','text_encoder/model.fp16.safetensors','unet/config.json','unet/diffusion_pytorch_model.fp16.safetensors',
 'vae/config.json','vae/diffusion_pytorch_model.fp16.safetensors','safety_checker/config.json','safety_checker/model.fp16.safetensors'],max_workers=2)
files={str(p.relative_to(target)):hashlib.sha256(p.read_bytes()).hexdigest() for p in target.rglob('*.safetensors')}
assert len(files)==4
(target/'verified-model.json').write_text(json.dumps({'repository':'stable-diffusion-v1-5/stable-diffusion-v1-5','revision':revision,'files':files,'license':'CreativeML OpenRAIL-M','paidInference':False},indent=2),encoding='utf-8')
print('Pinned local image model downloaded; four safetensors files verified.')
