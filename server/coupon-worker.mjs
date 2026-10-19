process.on('disconnect',()=>process.exit(0))
const [date,city]=process.argv.slice(2)
try{
 const {couponShowcase,meetingCouponShowcase}=await import('./coupon-showcase.mjs')
 const result=city?meetingCouponShowcase(date,city):couponShowcase(date,{collectSocial:false})
 process.send?.({result},()=>process.disconnect())
}catch(error){process.send?.({error:error.message},()=>process.disconnect())}
