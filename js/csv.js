export function detectDelimiter(sample){
  const comma = (sample.match(/,/g)||[]).length;
  const semi = (sample.match(/;/g)||[]).length;
  return semi > comma ? ";" : ",";
}
export function parseCSV(text){
  const delim = detectDelimiter(text.slice(0, 2000));
  const rows = [];
  let i=0, cur="", inQuotes=false;
  const pushCell = (row)=>{ row.push(cur); cur=""; };
  const pushRow = (row)=>{ rows.push(row); };
  let row = [];
  while(i<text.length){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ cur+='"'; i++; } else { inQuotes=false; }
      }else{ cur += c; }
    }else{
      if(c === '"'){ inQuotes = true; }
      else if(c === delim){ pushCell(row); }
      else if(c === '\n'){ pushCell(row); pushRow(row); row=[]; }
      else if(c === '\r'){}
      else{ cur += c; }
    }
    i++;
  }
  if(cur.length>0 || row.length>0){ pushCell(row); pushRow(row); }
  if(rows.length && rows[rows.length-1].every(x=>x==="" )) rows.pop();
  return rows;
}
