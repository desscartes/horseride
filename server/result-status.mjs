// Official zero + 'Derecesiz' is a known non-winning starter, not a missing result.
export function officialUnplaced(positionText,timeText){
 return String(positionText).trim()==='0'&&/^derecesiz$/iu.test(String(timeText).trim())
}
export function resolvedRunnerResult(result){
 return Number.isInteger(result?.finishPosition)&&(result.finishPosition>0||(result.finishPosition===0&&result.officialUnplaced===true))
}
export function isPlacedResult(result,places=3){
 return Number.isInteger(result?.finishPosition)&&result.finishPosition>0&&result.finishPosition<=places
}
