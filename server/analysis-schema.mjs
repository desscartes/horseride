export const analysisSchema = {
  type: 'object', additionalProperties: false, required: ['summary', 'races'],
  properties: {
    summary: { type: 'string' },
    races: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['city', 'raceNo', 'picks', 'confidence', 'risks', 'surprise'],
      properties: {
        city: { type: 'string' }, raceNo: { type: 'integer' },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        risks: { type: 'array', items: { type: 'string' } },
        surprise: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['horseName', 'reason'], properties: { horseName: { type: 'string' }, reason: { type: 'string' } } }] },
        picks: { type: 'array', items: {
          type: 'object', additionalProperties: false, required: ['horseName', 'reason'],
          properties: { horseName: { type: 'string' }, reason: { type: 'string' } },
        } },
      },
    } },
  },
}

export function schemaForRaces(races){
  const schema=structuredClone(analysisSchema)
  schema.properties.races.minItems=races.length
  schema.properties.races.maxItems=races.length
  schema.properties.races.items={anyOf:races.map(race=>{
    const item=structuredClone(analysisSchema.properties.races.items)
    item.properties.city.enum=[race.city]
    item.properties.raceNo.enum=[race.no]
    item.properties.picks.minItems=Math.min(4,race.horses.length)
    item.properties.picks.maxItems=Math.min(4,race.horses.length)
    item.properties.picks.items.properties.horseName.enum=race.analysisCandidates||race.horses.map(h=>h.name)
    return item
  })}
  return schema
}
