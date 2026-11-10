export function historyStoryPlan(episode){
 const plans={
  'epsom-1780':[
   ['Yıl, 1780. İngiltere’de, Epsom’dayız.',.91,.75],
   ['Bugün birçok yarışa adını veren derbi, o gün ilk kez koşulacaktı.',.98,.45],
   ['4 Mayıs’ta dokuz at start aldı. Önlerinde bir millik mesafe vardı. Yarış, üç yaşlı erkek ve dişi taylara açıktı.',.98,.55],
   ['İlk kazananın adı, Diomed. Sahibi ise Sir Charles Bunbury.',.88,.8],
   ['Burada küçük bir ayrıntı var: ilk derbinin mesafesi, bugünkünden farklıydı.',.95,.6],
   ['Derbi tarihinin ilk sayfasında, Diomed’in adı kaldı.',.90,.55]
  ],
  'gazi-1928':[
   ['Takvimler 1928’i gösteriyor. Gazi Koşusu, ikinci yılına giriyor.',.91,.75],
   ['İlk yarışın ardından, koşunun şartları değişmişti. Bu kez yaşa göre sıklet esasına dayanan açık bir yarış düzenleniyordu.',.98,.55],
   ['O yılın kazananı, Primerole oldu. Atın sahibi, Atıf Bey’di.',.88,.8],
   ['Gazi Koşusu’nun ilk iki yılı, aynı isim altında farklı koşulların uygulanabildiğini gösteriyor.',.96,.45],
   ['Yarış tarihini okurken yalnız kazananlara değil, o yılın yarış şartlarına da bakmak gerekiyor.',.92,.6]
  ],
  'kentucky-1875':[
   ['Amerika Birleşik Devletleri. Tarih, 17 Mayıs 1875.',.91,.75],
   ['Kentucky Derbisi ilk kez koşuluyor. On beş at, bir buçuk millik yarış için start alıyor.',.98,.55],
   ['Resmî tarihçeye göre, yarışı yaklaşık on bin kişi izliyor.',.97,.45],
   ['İlk kazanan, Aristides. Jokeyi Oliver Lewis, antrenörü Ansel Williamson.',.89,.8],
   ['Kentucky Derbisi’nin uzun kazananlar listesi, o gün bu isimlerle başladı.',.91,.55]
  ]
 };
 const plan=plans[episode.id];if(!plan)return episode;
 const narrationSegments=plan.map(([text,speed,pauseAfter])=>({text,speed,pauseAfter}));
 return {...episode,narration:narrationSegments.map(s=>s.text).join(' '),narrationSegments,editorialStyle:'historical-story-v2'};
}
