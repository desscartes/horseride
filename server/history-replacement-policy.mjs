// One exact user-requested replacement; no general bypass of daily duplicate/quality rules.
export function authorizedReplacement(p,old,{day,id,sha}){
 return p?.userRequested===true&&p.mediaUploadAuthorization==='explicitly_approved'&&p.day===day&&p.newPublicationId===id&&p.newVideoSha256===sha&&p.status==='removal_verified'&&old?.id===p.oldPublicationId&&old.mediaId===p.oldMediaId&&old.status==='removed_by_user_request';
}
