"""Daily delivery state must be derived from verified publication receipts, not preview existence."""
def daily_state(day, publications, selected_publication=None, voice_day=None):
 for p in publications:
  if p.get('day')==day and p.get('status')=='published_verified' and p.get('permalink'):
   return {'day':day,'status':'daily_published_verified','todayPublished':True,'published':True,'permalink':p['permalink']}
 if selected_publication:
  if selected_publication.get('status')=='publishing_unknown':return {'day':day,'status':'publication_reconciliation_required','todayPublished':False,'published':False}
  if selected_publication.get('status')=='published_verified':return {'day':day,'status':'needs_new_daily_story','todayPublished':False,'published':True,'previousPublication':selected_publication.get('permalink'),'reason':'Selected episode was already published; do not reuse it as today’s preview'}
 if voice_day and voice_day!=day:return {'day':day,'status':'stale_daily_voice','todayPublished':False,'published':False,'reason':'Narration day does not match the current Turkish calendar day'}
 return None
