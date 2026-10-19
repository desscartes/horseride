import {readFile} from 'node:fs/promises'

// An explicitly frozen input must never silently become an empty dataset.
export async function trainingSourceRows({path,fallbackPath,field,read=readFile}){
 let text
 try{text=await read(path||fallbackPath,'utf8')}
 catch(error){if(!path&&error.code==='ENOENT')return [];throw error}
 const data=JSON.parse(text)
 if(!Array.isArray(data?.[field]))throw Error(`Invalid training source ${path||fallbackPath}: ${field} must be an array`)
 return data[field]
}
