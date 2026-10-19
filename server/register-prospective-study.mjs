import {pinIntelligenceStudy} from './prospective-model-pin.mjs'
const [root,list='TR,US,TR-arabian,TR-thoroughbred']=process.argv.slice(2)
if(!root)throw Error('Usage: versionedStudyRoot [artifacts]')
console.log(JSON.stringify(await pinIntelligenceStudy(root,list.split(','))))
