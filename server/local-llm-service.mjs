import {spawn} from 'node:child_process'
import {mkdirSync,openSync,closeSync} from 'node:fs'
export async function ensureLocalLlm(){
 if(process.env.HORSERIDE_ANALYSIS_PROVIDER!=='local')return
 try{const r=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(1500)});if(r.ok)return}catch{}
 mkdirSync('data/maintenance/local-llm',{recursive:true});const output=openSync('data/maintenance/local-llm/service.log','a')
 const child=spawn(process.env.HORSERIDE_LOCAL_BINARY||'D:/Tools/Ollama/ollama.exe',['serve'],{windowsHide:true,detached:true,stdio:['ignore',output,output],env:{...process.env,OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_MODELS:process.env.HORSERIDE_LOCAL_MODELS||'D:/Models/HorseRide',OLLAMA_NUM_PARALLEL:'1',OLLAMA_MAX_LOADED_MODELS:'1',OLLAMA_NO_CLOUD:'1'}})
 child.on('error',error=>console.error('Local LLM launch:',error.code));child.unref();closeSync(output)
}
