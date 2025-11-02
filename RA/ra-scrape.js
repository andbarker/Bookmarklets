(function(){

  // ===== helpers =====
  function txt(el){ return el ? el.textContent.trim() : ''; }
  function norm(s){ return (s||'').replace(/\s+/g,' ').trim().toLowerCase(); }

  function toDateISO(s){
    if(!s) return null;
    s = s.replace(/^[A-Za-z]+,\s*/, '').trim();
    var m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if(!m) return null;
    var d=m[1], mon=m[2].toLowerCase(), y=m[3];
    var mm = {
      january:'01', february:'02', march:'03', april:'04', may:'05', june:'06',
      july:'07', august:'08', september:'09', october:'10', november:'11', december:'12'
    }[mon];
    if(!mm) return null;
    if(d.length===1) d='0'+d;
    return y+'-'+mm+'-'+d;
  }

  // ===== scrape flat (meeting + races + horses) =====
  function scrapeFlat(){
    var meeting = {};
    var vh = document.querySelector('.race-venue .top h2');
    if(vh){
      var full = txt(vh);
      var dt = vh.querySelector('.race-venue-date');
      if(dt){
        meeting.date_text = dt.textContent.trim();
        meeting.date = toDateISO(meeting.date_text);
        full = full.replace(meeting.date_text,'').trim();
      }
      meeting.track_name = full;
    }

    var races = [];
    var horses = [];
    var anchors = document.querySelectorAll('a[name^="Race"]');

    for(var i=0;i<anchors.length;i++){
      var a = anchors[i];
      var raceNo = +a.name.replace('Race','');

      // find title
      var title = a.nextElementSibling;
      while(title && !title.classList.contains('race-title')) title=title.nextElementSibling;
      if(!title) continue;

      var th = title.querySelector('th');
      var t  = txt(th);
      var m  = t.match(/-\s*([0-9:APM]+)\s+(.*)/i);
      var tm=null, rname=null, dist=null;
      if(m){ tm=m[1].trim(); rname=m[2].trim(); }
      else { rname=t; }

      var md = rname && rname.match(/\((\d+)\s+METRES?\)/i);
      if(md){ dist=+md[1]; rname=rname.replace(md[0],'').trim(); }

      // runners
      var tbl = title.nextElementSibling;
      while(tbl && !tbl.classList.contains('race-strip-fields')) tbl=tbl.nextElementSibling;

      var count=0;
      if(tbl){
        var rows = tbl.querySelectorAll('tr.OddRow, tr.EvenRow');
        rows.forEach(function(row){
          var tds = row.children;
          var num = parseInt(tds[0].textContent)||null;
          var hcell = tds[2];
          var hlink = hcell.querySelector('a');
          var hname = (hlink||hcell).textContent.trim();
          horses.push({
            race_no: raceNo,
            runner_no: num,
            horse_name: hname
          });
          count++;
        });
      }

      races.push({
        race_no: raceNo,
        race_name: rname,
        scheduled_time_text: tm,
        distance_m: dist,
        runner_count: count
      });
    }

    return {meeting:meeting, races:races, horses:horses};
  }

  // ===== add form/runs for ONE race by matching names =====
  function enrichRaceByName(base, raceNo){
    var wanted = {};
    base.horses.forEach(function(h){
      if(h.race_no===raceNo){
        wanted[norm(h.horse_name)] = h;
      }
    });

    var forms = document.querySelectorAll('.horse-form-table');
    forms.forEach(function(f){
      var hi = f.querySelector('.horse-info');
      if(!hi) return;
      var nmEl = hi.querySelector('.horse-name a, .horse-name');
      if(!nmEl) return;
      var nm = nmEl.textContent.trim();
      var key = norm(nm);
      var target = wanted[key];
      if(!target) return;

      var runs = [];
      var t = f.querySelector('table.horse-last-start');
      if(t){
        var rr = t.querySelectorAll('tr.OddRow, tr.EvenRow');
        rr.forEach(function(rtr){
          var line = rtr.textContent.replace(/\s+/g,' ').trim();
          line = line.replace('$000',''); // jumpout fix
          runs.push(line);
        });
      }
      target.detail = {runs:runs};
    });
  }

  // ===== show json (iOS friendly) =====
  function showJSON(obj, fname){
    var json = JSON.stringify(obj,null,2);
    var ta = document.getElementById('ra_box');
    if(!ta){
      ta = document.createElement('textarea');
      ta.id='ra_box';
      ta.style.width='100%';
      ta.style.height='50vh';
      ta.style.fontFamily='monospace';
      document.body.insertBefore(ta, document.body.firstChild);
    }
    ta.value = json;

    var link = document.getElementById('ra_dl');
    if(!link){
      link = document.createElement('a');
      link.id='ra_dl';
      link.textContent='Download JSON';
      link.style.display='block';
      link.style.margin='6px 0';
      document.body.insertBefore(link, ta.nextSibling);
    }
    link.href='data:application/json;charset=utf-8,'+encodeURIComponent(json);
    link.download=fname;
  }

  // ===== main =====
  var base = scrapeFlat();
  window.__RA_SNAP = base;

  var jsonStr = JSON.stringify(base);
  var small = jsonStr.length < 300000; // ~300 KB

  var track = (base.meeting.track_name||'track').replace(/\s+/g,'-');
  var date  = (base.meeting.date||base.meeting.date_text||'meeting').replace(/\s+/g,'-');

  if(small){
    showJSON(base, 'ra-'+track+'-'+date+'.json');
  } else {
    var rn = prompt('Big meet. Which race? (1-'+base.races.length+')');
    if(!rn){ alert('No race selected'); return; }
    rn = parseInt(rn,10);
    enrichRaceByName(base, rn);
    var sub = {
      meeting: base.meeting,
      races: base.races.filter(function(r){return r.race_no===rn;}),
      horses: base.horses.filter(function(h){return h.race_no===rn;})
    };
    showJSON(sub, 'ra-'+track+'-'+date+'-R'+rn+'.json');
  }

})();
