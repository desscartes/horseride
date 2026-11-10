function Assert-HistoryVoiceCalendar($manifest){
 $culture=[Globalization.CultureInfo]::InvariantCulture
 $day=[datetime]::ParseExact([string]$manifest.date,'yyyy-MM-dd',$culture)
 $anchor=[datetime]::ParseExact('2026-11-03','yyyy-MM-dd',$culture)
 $expected=if((($day-$anchor).Days%2) -eq 0){'tr-TR-AhmetNeural'}else{'tr-TR-EmelNeural'}
 if($manifest.voice.day -ne $manifest.date -or $manifest.voice.voice -ne $expected){throw 'Historical narration voice/day mismatch; publication blocked'}
 return $expected
}
