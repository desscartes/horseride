export function maintenanceArchiveSummary(database,country,through,trainedThrough){
 if(!['TR','US'].includes(country)||![through,trainedThrough].every(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)))throw Error('Invalid maintenance archive scope')
 const scope=country==='TR'?"COALESCE(json_extract(race_json,'$.foreign'),0)=0":"COALESCE(json_extract(race_json,'$.foreign'),0)<>0 AND substr(city,-3)='ABD' COLLATE BINARY"
 const row=database.prepare(`SELECT count(*) AS races,COALESCE(SUM(CASE WHEN date>? THEN 1 ELSE 0 END),0) AS newerRaces FROM historical_race_data WHERE date<=? AND (${scope})`).get(trainedThrough,through)
 return {races:Number(row.races),newerRaces:Number(row.newerRaces)}
}
