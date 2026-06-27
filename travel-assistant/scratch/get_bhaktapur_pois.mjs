import fs from 'fs';

const bbox = '(27.655,85.402,27.690,85.458)';

const subqueries = [
  // 1. Places of worship & shrines
  `node["amenity"="place_of_worship"]${bbox}; node["amenity"="shrine"]${bbox};`,
  // 2. Ponds, wells, water bodies
  `node["natural"="water"]${bbox}; node["water"="pond"]${bbox}; node["man_made"="water_well"]${bbox}; node["man_made"="fountain"]${bbox};`,
  // 3. Neighborhoods, suburbs, and historical zones
  `node["place"~"neighbourhood|quarter|suburb"]${bbox}; node["historic"]${bbox}; node["tourism"~"attraction|viewpoint"]${bbox};`
];

const endpoints = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

async function fetchWithEndpoint(endpoint, subquery) {
  const queryBody = `[out:json][timeout:30];(${subquery});out body;`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: 'data=' + encodeURIComponent(queryBody)
  });
  
  if (!response.ok) {
    throw new Error(`Status ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

async function runQuery(subquery) {
  for (const endpoint of endpoints) {
    try {
      const data = await fetchWithEndpoint(endpoint, subquery);
      return data.elements || [];
    } catch (e) {
      console.warn(`Endpoint ${endpoint} failed for subquery: ${e.message}`);
    }
  }
  throw new Error('All endpoints failed for subquery.');
}

async function fetchPOIs() {
  const allElements = [];
  
  for (let i = 0; i < subqueries.length; i++) {
    console.log(`Running subquery ${i + 1}/${subqueries.length}...`);
    try {
      const elements = await runQuery(subqueries[i]);
      console.log(`Subquery ${i + 1} returned ${elements.length} elements.`);
      allElements.push(...elements);
    } catch (err) {
      console.error(`Subquery ${i + 1} failed completely: ${err.message}`);
    }
    // Polite delay between requests
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log(`Total elements collected: ${allElements.length}`);
  
  const results = [];
  for (const el of allElements) {
    const name = el.tags?.name;
    const nameEn = el.tags?.['name:en'] || name;
    if (!nameEn) continue;
    
    // Skip purely devanagari names
    const hasDevanagari = /[\u0900-\u097F]/.test(nameEn);
    const hasEnglishLetters = /[a-zA-Z]/.test(nameEn);
    if (hasDevanagari && !hasEnglishLetters) {
      continue;
    }
    
    // Filter out some garbage names or generic words like "temple", "shrine", or custom names
    const nameLower = nameEn.toLowerCase();
    if (nameLower === 'temple' || nameLower === 'shrine' || nameLower === 'water tap' || nameLower === 'stone spout') {
      continue;
    }
    if (nameLower.includes('sandip khanal') || nameLower.includes('test')) {
      continue;
    }
    
    // Determine category based on tags
    let category = 'landmark';
    let hook = 'a local landmark';
    
    if (el.tags?.amenity === 'place_of_worship' || el.tags?.amenity === 'shrine') {
      category = 'shrine';
      hook = 'a traditional Newar shrine';
      if (el.tags?.denomination === 'buddhist' || el.tags?.religion === 'buddhist') {
        category = 'buddhist shrine';
        hook = 'a sacred Buddhist shrine';
      }
    } else if (el.tags?.natural === 'water' || el.tags?.water === 'pond') {
      category = 'pond';
      hook = 'a historic public pond';
    } else if (el.tags?.place) {
      category = 'neighborhood';
      hook = 'a Newar settlement area';
    } else if (el.tags?.historic) {
      category = 'heritage site';
      hook = 'a historical heritage site';
    } else if (el.tags?.tourism === 'attraction' || el.tags?.tourism === 'viewpoint') {
      category = 'scenic point';
      hook = 'a tourist attraction and viewpoint';
    } else if (el.tags?.man_made === 'water_well' || el.tags?.man_made === 'fountain') {
      category = 'stone spout';
      hook = 'a traditional stone spout and water source';
    }
    
    results.push({
      id: `bkt-${el.id}`,
      name: nameEn,
      category: category,
      lat: parseFloat(el.lat.toFixed(6)),
      lng: parseFloat(el.lon.toFixed(6)),
      short_hook: `${hook} in Bhaktapur.`,
    });
  }
  
  // Filter unique names to avoid duplicates
  const uniqueResults = [];
  const seen = new Set();
  
  // Also avoid duplicating our existing curated POIs:
  const curatedIds = [
    'bhaktapur-nyatapola', 'bhaktapur-bhairavnath-temple', 'bhaktapur-vatsala-devi-temple',
    'bhaktapur-dattatreya-temple', 'bhaktapur-fasidega-temple', 'bhaktapur-kedarnath-temple'
  ];
  const curatedNames = [
    'nyatapola', 'bhairavnath', 'vatsala devi', 'vatsala temple', 'dattatreya', 'dattatraya',
    'fasidega', 'silu mahadev', 'kedarnath'
  ];
  
  for (const r of results) {
    const key = r.name.toLowerCase().trim();
    if (seen.has(key)) continue;
    
    // Check if it duplicates a curated name
    const isCurated = curatedNames.some(cn => key.includes(cn));
    if (isCurated) continue;
    
    seen.add(key);
    uniqueResults.push(r);
  }
  
  console.log(`Filtered to ${uniqueResults.length} unique named POIs.`);
  fs.writeFileSync('c:/Users/Rexsh/Desktop/Trace/travel-assistant/scratch/pois.json', JSON.stringify(uniqueResults, null, 2));
  console.log('Results written to scratch/pois.json');
}

fetchPOIs().catch(err => console.error(err));
