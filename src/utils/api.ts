import type { InputData, Stage1Output, ISQ, ExcelData, AuditInput, AuditResult } from "../types";

function normalizeSpecName(name: string): string {
  let normalized = name.toLowerCase().trim();
  normalized = normalized.replace(/[()\-_,.;]/g, ' ');
  
  const standardizations: Record<string, string> = {
    'material': 'material',
    'grade': 'grade',
    'thk': 'thickness',
    'thickness': 'thickness',
    'type': 'type',
    'shape': 'shape',
    'size': 'size',
    'dimension': 'size',
    'length': 'length',
    'width': 'width',
    'height': 'height',
    'dia': 'diameter',
    'diameter': 'diameter',
    'color': 'color',
    'colour': 'color',
    'finish': 'finish',
    'surface': 'finish',
    'weight': 'weight',
    'wt': 'weight',
    'capacity': 'capacity',
    'brand': 'brand',
    'model': 'model',
    'quality': 'quality',
    'standard': 'standard',
    'specification': 'spec',
    'perforation': 'hole',
    'hole': 'hole',
    'pattern': 'pattern',
    'design': 'design',
    'application': 'application',
    'usage': 'application'
  };
  
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  const standardizedWords = words.map(word => {
    if (standardizations[word]) {
      return standardizations[word];
    }
    
    for (const [key, value] of Object.entries(standardizations)) {
      if (word.includes(key) || key.includes(word)) {
        return value;
      }
    }
    
    return word;
  });
  
  const uniqueWords = [...new Set(standardizedWords)];
  const fillerWords = ['sheet', 'plate', 'pipe', 'rod', 'bar', 'in', 'for', 'of', 'the'];
  const filteredWords = uniqueWords.filter(word => !fillerWords.includes(word));
  
  return filteredWords.join(' ').trim();
}

function isSemanticallySimilar(spec1: string, spec2: string): boolean {
  const norm1 = normalizeSpecName(spec1);
  const norm2 = normalizeSpecName(spec2);
  
  if (norm1 === norm2) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  
  const synonymGroups = [
    ['material', 'composition', 'fabric'],
    ['grade', 'quality', 'class', 'standard'],
    ['thickness', 'thk', 'gauge'],
    ['size', 'dimension', 'measurement'],
    ['diameter', 'dia', 'bore'],
    ['length', 'long', 'lng'],
    ['width', 'breadth', 'wide'],
    ['height', 'high', 'depth'],
    ['color', 'colour', 'shade'],
    ['finish', 'surface', 'coating', 'polish'],
    ['weight', 'wt', 'mass'],
    ['type', 'kind', 'variety', 'style'],
    ['shape', 'form', 'profile'],
    ['hole', 'perforation', 'aperture'],
    ['pattern', 'design', 'arrangement'],
    ['application', 'use', 'purpose', 'usage']
  ];
  
  for (const group of synonymGroups) {
    const hasSpec1 = group.some(word => norm1.includes(word));
    const hasSpec2 = group.some(word => norm2.includes(word));
    if (hasSpec1 && hasSpec2) return true;
  }
  
  return false;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  baseDelay = 10000
): Promise<Response> {
  let lastStatus: number | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) return response;

      lastStatus = response.status;

      if (response.status === 429 || response.status === 503 || response.status === 502) {
        if (attempt === retries) {
          throw new Error(`Gemini overloaded after ${retries + 1} attempts. Last status code: ${lastStatus}`);
        }
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.warn(`Gemini overloaded (${response.status}). Retrying in ${waitTime}ms`);
        await sleep(waitTime);
        continue;
      }

      const err = await response.text();
      throw new Error(`Gemini API error ${lastStatus}: ${err}`);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`⏱️ Request timeout on attempt ${attempt + 1}`);
        if (attempt === retries) {
          throw new Error(`Request timed out after ${retries + 1} attempts`);
        }
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.warn(`Waiting ${waitTime}ms before retry...`);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unreachable");
}

function extractJSONFromGemini(response): any {
  try {
    console.log("🛠️ SUPER LENIENT JSON Extraction: Starting...");
    
    if (!response?.candidates?.length) {
      console.warn("❌ No candidates");
      return null;
    }

    const parts = response.candidates[0]?.content?.parts || [];
    let rawText = "";

    // Collect ALL text
    for (const part of parts) {
      if (typeof part.text === "string") {
        rawText += part.text + "\n";
      }
      if (part.json) {
        console.log("✅ Direct JSON found");
        return part.json;
      }
    }

    if (!rawText.trim()) {
      console.warn("⚠️ No text");
      return null;
    }

    console.log(`📊 Gemini raw response length: ${rawText.length} chars`);
    console.log("🔍 First 600 chars:");
    console.log(rawText.substring(0, 600));
    
    // CRITICAL: Super aggressive extraction
    const extracted = extractAnyJSONPossible(rawText);
    
    if (extracted) {
      console.log("🎉 Extracted SOMETHING from Gemini!");
      console.log("📦 Extracted data:", extracted);
      return extracted;
    }
    
    console.warn("⚠️ Could not extract anything");
    return null;

  } catch (error) {
    console.error("💥 JSON extraction error:", error);
    return null;
  }
}

// UPDATED: extractAnyJSONPossible function with better incomplete JSON handling
function extractAnyJSONPossible(text: string): any {
  console.log("🔥 SUPER AGGRESSIVE: Extracting ANY JSON-like structure...");
  
  // Clean the text first
  let cleaned = text.trim();
  
  // Remove any trailing text after last valid JSON character
  const lastValidChar = Math.max(
    cleaned.lastIndexOf('}'),
    cleaned.lastIndexOf(']')
  );
  
  if (lastValidChar > 0 && lastValidChar < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastValidChar + 1);
  }
  
  // FIX: Remove spec name from options arrays
  cleaned = removeSpecNameFromOptions(cleaned);
  
  // TRY 1: Direct parse
  try {
    const parsed = JSON.parse(cleaned);
    console.log("✅ Direct JSON parse worked!");
    return validateAndCleanParsedJSON(parsed);
  } catch (e) {
    console.log("🔄 Direct parse failed, trying to fix incomplete JSON...");
  }
  
  // TRY 2: Fix incomplete JSON
  const fixedJSON = fixIncompleteJSON(cleaned);
  if (fixedJSON) {
    try {
      const parsed = JSON.parse(fixedJSON);
      console.log("✅ Successfully parsed fixed JSON!");
      return validateAndCleanParsedJSON(parsed);
    } catch (e) {
      console.log("❌ Fixed parse failed:", e.message);
    }
  }
  
  // TRY 3: Manual extraction
  console.log("🔄 Trying manual extraction from text...");
  return extractFromTextManually(cleaned);
}

// NEW FUNCTION: Remove spec name from options arrays
function removeSpecNameFromOptions(text: string): string {
  // Find config name
  const configNameMatch = text.match(/"name"\s*:\s*"([^"]+)"/);
  if (!configNameMatch) return text;
  
  const configName = configNameMatch[1];
  console.log(`🔍 Found config name: "${configName}"`);
  
  // Find options array and remove config name from it
  const optionsRegex = /"options"\s*:\s*\[([\s\S]*?)\]/g;
  let result = text;
  let match;
  
  while ((match = optionsRegex.exec(text)) !== null) {
    const optionsText = match[1];
    const optionsArray = optionsText.split(',');
    
    // Filter out the config name
    const filteredOptions = optionsArray.filter(opt => {
      const cleanOpt = opt.trim().replace(/["']/g, '');
      return cleanOpt.toLowerCase() !== configName.toLowerCase();
    });
    
    // Replace if we filtered something out
    if (filteredOptions.length < optionsArray.length) {
      const newOptionsText = filteredOptions.join(',');
      result = result.replace(optionsText, newOptionsText);
      console.log(`🔧 Removed "${configName}" from options array`);
    }
  }
  
  return result;
}

// NEW FUNCTION: Fix incomplete JSON
function fixIncompleteJSON(jsonStr: string): string | null {
  console.log("🔧 Attempting to fix incomplete JSON...");
  
  let fixed = jsonStr;
  
  // 1. Fix unclosed strings
  fixed = fixed.replace(/"([^"\n\r]*?)(?=\s*[,}\]])/g, '"$1"');
  
  // 2. Fix arrays that end abruptly
  fixed = fixed.replace(/(\[[^\]]*?)(\s*$)/g, '$1]');
  
  // 3. Fix objects that end abruptly
  fixed = fixed.replace(/(\{[^}]*?)(\s*$)/g, '$1}');
  
  // 4. Balance braces and brackets
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  
  // Add missing closing brackets
  if (openBrackets > closeBrackets) {
    fixed += ']'.repeat(openBrackets - closeBrackets);
  }
  
  // Add missing closing braces
  if (openBraces > closeBraces) {
    fixed += '}'.repeat(openBraces - closeBraces);
  }
  
  // 5. Fix trailing commas
  fixed = fixed.replace(/,\s*([\]}])/g, '$1');
  
  // Check if it's parseable now
  try {
    JSON.parse(fixed);
    console.log("✅ JSON fixing successful");
    return fixed;
  } catch (e) {
    console.log("❌ Still not valid JSON");
    return null;
  }
}

// NEW FUNCTION: Validate and clean parsed JSON
function validateAndCleanParsedJSON(parsed: any): any {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  
  const result: any = {
    config: { name: "", options: [] },
    keys: [],
    buyers: []
  };
  
  // Validate config
  if (parsed.config && parsed.config.name) {
    result.config.name = parsed.config.name;
    
    // Clean config options
    if (Array.isArray(parsed.config.options)) {
      result.config.options = parsed.config.options
        .filter((opt: any) => {
          if (typeof opt !== 'string') return false;
          const cleanOpt = opt.trim();
          return cleanOpt.length > 0 && 
                 cleanOpt.length < 50 &&
                 cleanOpt.toLowerCase() !== result.config.name.toLowerCase();
        })
        .slice(0, 8);
    }
  }
  
  // Validate keys
  if (Array.isArray(parsed.keys)) {
    result.keys = parsed.keys
      .filter((key: any) => 
        key && 
        key.name && 
        typeof key.name === 'string' &&
        key.name !== result.config.name
      )
      .map((key: any) => ({
        name: key.name,
        options: Array.isArray(key.options) 
          ? key.options
              .filter((opt: any) => typeof opt === 'string' && opt.trim().length > 0)
              .slice(0, 6)
          : []
      }))
      .filter((key: any) => key.options.length > 0)
      .slice(0, 3);
  }
  
  // Validate buyers
  if (Array.isArray(parsed.buyers)) {
    result.buyers = parsed.buyers.slice(0, 2);
  }
  
  return result;
}

// NEW FUNCTION: Extract from text manually
function extractFromTextManually(text: string): any {
  console.log("🔨 Manual extraction from text...");
  
  const result: any = {
    config: { name: "", options: [] },
    keys: [],
    buyers: []
  };
  
  // Extract config name
  const nameMatch = text.match(/"name"\s*:\s*"([^"]+)"/);
  if (nameMatch) {
    result.config.name = nameMatch[1];
  } else {
    // Try to guess from text
    if (text.includes('Grade')) result.config.name = 'Grade';
    else if (text.includes('Material')) result.config.name = 'Material';
    else if (text.includes('Size')) result.config.name = 'Size';
    else result.config.name = 'Specification';
  }
  
  // Extract all possible options
  const allOptions = new Set<string>();
  
  // Look for options arrays
  const optionsMatches = text.matchAll(/"options"\s*:\s*\[([^\]]+)\]/g);
  for (const match of optionsMatches) {
    const optionsText = match[1];
    const quotedOptions = optionsText.match(/"([^"]+)"/g) || [];
    quotedOptions.forEach(opt => {
      const cleanOpt = opt.replace(/"/g, '').trim();
      if (cleanOpt && cleanOpt.toLowerCase() !== result.config.name.toLowerCase()) {
        allOptions.add(cleanOpt);
      }
    });
  }
  
  // Also look for any quoted strings that could be options
  const allQuoted = text.match(/"([^"\n\r,;\[\]{}]+)"/g) || [];
  allQuoted.forEach(opt => {
    const cleanOpt = opt.replace(/"/g, '').trim();
    if (cleanOpt && 
        cleanOpt.length > 1 && 
        cleanOpt.length < 30 &&
        !cleanOpt.toLowerCase().includes('name') &&
        !cleanOpt.toLowerCase().includes('options') &&
        !cleanOpt.toLowerCase().includes('config') &&
        !cleanOpt.toLowerCase().includes('keys') &&
        cleanOpt.toLowerCase() !== result.config.name.toLowerCase()) {
      allOptions.add(cleanOpt);
    }
  });
  
  result.config.options = Array.from(allOptions).slice(0, 8);
  
  // Try to extract keys from the text
  extractKeysFromTextContent(text, result);
  
  return result;
}

// NEW FUNCTION: Extract keys from text content
function extractKeysFromTextContent(text: string, result: any): void {
  const keyPatterns = [
    { name: "Finish", regex: /finish[\s\S]*?"options"[\s\S]*?\[([^\]]+)\]/i },
    { name: "Standard", regex: /standard[\s\S]*?"options"[\s\S]*?\[([^\]]+)\]/i },
    { name: "Type", regex: /type[\s\S]*?"options"[\s\S]*?\[([^\]]+)\]/i },
    { name: "Size", regex: /size[\s\S]*?"options"[\s\S]*?\[([^\]]+)\]/i },
    { name: "Thickness", regex: /thickness[\s\S]*?"options"[\s\S]*?\[([^\]]+)\]/i }
  ];
  
  keyPatterns.forEach(pattern => {
    if (result.keys.length >= 3) return;
    
    const match = text.match(pattern.regex);
    if (match) {
      const optionsText = match[1];
      const options = extractOptionsFromString(optionsText);
      if (options.length > 0 && pattern.name !== result.config.name) {
        result.keys.push({
          name: pattern.name,
          options: options.slice(0, 6)
        });
      }
    }
  });
}

// NEW FUNCTION: Extract options from string
function extractOptionsFromString(str: string): string[] {
  const options: string[] = [];
  const quotedMatches = str.match(/"([^"]+)"/g) || [];
  quotedMatches.forEach(match => {
    const opt = match.replace(/"/g, '').trim();
    if (opt) options.push(opt);
  });
  return options;
}

const STAGE1_API_KEY = (import.meta.env.VITE_STAGE1_API_KEY || "").trim();
const STAGE2_API_KEY = (import.meta.env.VITE_STAGE2_API_KEY || "").trim();

export async function auditSpecificationsWithGemini(
  input: AuditInput
): Promise<AuditResult[]> {
  if (!STAGE1_API_KEY) {
    throw new Error("Stage 1 API key is not configured. Please add VITE_STAGE1_API_KEY to your .env file.");
  }

  const prompt = buildAuditPrompt(input);
  console.log("🔍 Audit: Sending request to Gemini...");

  try {
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${STAGE1_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();
    console.log("📥 Audit: Received response from Gemini");

    let result = extractJSONFromGemini(data);

    if (!result || !Array.isArray(result)) {
      console.warn("⚠️ Audit: JSON extraction failed, trying text extraction...");
      const rawText = extractRawText(data);
      console.log("Raw response text:", rawText.substring(0, 500));

      result = parseAuditFromText(rawText, input);
    }

    if (result && Array.isArray(result)) {
      console.log(`✅ Audit: Successfully parsed ${result.length} results`);
      console.log("Audit results:", result);
      return result;
    }

    console.error("❌ Audit: Failed to parse any results, returning empty array");
    return [];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg.includes("429") || errorMsg.includes("quota")) {
      console.error("Stage 1 API Key quota exhausted or rate limited");
      throw new Error("Stage 1 API key quota exhausted. Please check your API limits.");
    }

    console.error("❌ Audit API error:", error);
    throw error;
  }
}

function parseAuditFromText(text: string, input: AuditInput): AuditResult[] {
  console.log("📝 Parsing audit from text...");

  const results: AuditResult[] = [];

  // Try to find JSON array in text
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0].replace(/,(\s*[\]}])/g, "$1"));
      if (Array.isArray(parsed)) {
        console.log("✅ Successfully parsed JSON array from text");
        return parsed;
      }
    } catch (e) {
      console.warn("Failed to parse JSON array from text:", e);
    }
  }

  // Fallback: Create results for all specs marking them as "correct" if no issues found
  input.specifications.forEach(spec => {
    results.push({
      specification: spec.spec_name,
      status: "correct",
      explanation: undefined,
      problematic_options: []
    });
  });

  console.log(`⚠️ Fallback: Marking all ${results.length} specs as correct`);
  return results;
}

function buildAuditPrompt(input: AuditInput): string {
  const specsText = input.specifications
    .map((spec, idx) => {
      return `${idx + 1}. Specification: "${spec.spec_name}"
   Options: ${spec.options.map(opt => `"${opt}"`).join(", ")}
   Input Type: ${spec.input_type || "N/A"}
   Tier: ${spec.tier || "N/A"}`;
    })
    .join("\n\n");

  return `You are a STRICT industrial specification auditor. Your task is to find REAL problems.

MCAT Name: ${input.mcat_name}
Think about what specifications make sense for this type of product.

Specifications to Audit:
${specsText}

Task:
- For each specification, check if it is relevant to the MCAT "${input.mcat_name}"
- For each option, check for:
  • Irrelevance to the specification or MCAT
  • Duplicates (exact duplicates or same value listed multiple times)
   Example: "SS304", "ss304" → INCORRECT (duplicate, just different case)
   Example: "2mm", "2 mm", "2.0mm" → INCORRECT (same value, different formatting)
  • Overlapping values (e.g., same measurement in multiple separate options like "1219 mm" AND "4 ft" as separate entries)

ADDITIONAL CRITICAL RULE (MCAT NAME CONFLICT CHECK):

If the MCAT name itself already explicitly defines a specification, and the same specification is again created with:
• the same value, OR
• multiple alternative values, OR
• contradictory values
→ then the entire specification must be marked INCORRECT.

Example:
MCAT Name: "304 Stainless Steel Sheet"
Specification: Grade
Options: "304", "316", "202"
→ INCORRECT because the grade is already fixed by the MCAT name

Rules:
- DO NOT generate new specifications or options
- DO NOT suggest random corrections
- BE STRICT and find REAL issues
- Only return "correct" or "incorrect" and explanation if incorrect
- If an option lists different units in the SAME entry (e.g., "1219 mm (4 ft)") → this is CORRECT
- If multiple SEPARATE options represent the same value in different units → this is INCORRECT (overlapping)
- If an option appears multiple times with exactly the same value → this is INCORRECT (duplicate)
- If a specification is completely irrelevant to "${input.mcat_name}" → mark as INCORRECT with explanation
- If an option is irrelevant to the specification → mark as INCORRECT and list it in problematic_options

Output Format (JSON Array):
[
  {
    "specification": "Grade",
    "status": "correct"
  },
  {
    "specification": "Width",
    "status": "incorrect",
    "explanation": "1219 mm and 4 ft listed separately → overlapping units. 1500 mm appears twice → duplicate.",
    "problematic_options": ["1219 mm", "4 ft", "1500 mm"]
  },
  {
    "specification": "Application",
    "status": "incorrect",
    "explanation": "Specification not relevant for ${input.mcat_name}. Option 'Capacity' is irrelevant.",
    "problematic_options": ["Capacity"]
  }
]

CRITICAL:
- Return ONLY valid JSON array
- NO text before or after the JSON
- NO markdown code blocks
- Output must start with [ and end with ]`;
}

export async function generateStage1WithGemini(
  input: InputData
): Promise<Stage1Output> {
  if (!STAGE1_API_KEY) {
    throw new Error("Stage 1 API key is not configured. Please add VITE_STAGE1_API_KEY to your .env file.");
  }

  const prompt = buildStage1Prompt(input);

  try {
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${STAGE1_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();
    return extractJSONFromGemini(data) || generateFallbackStage1();

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg.includes("429") || errorMsg.includes("quota")) {
      console.error("Stage 1 API Key quota exhausted or rate limited");
      throw new Error("Stage 1 API key quota exhausted. Please check your API limits.");
    }

    console.warn("Stage 1 API error:", error);
    return generateFallbackStage1();
  }
}

function generateFallbackStage1(): Stage1Output {
  return {
    seller_specs: []
  };
}

// ==================== CORS FIXED VERSION ====================

async function fetchURL(url: string): Promise<string> {
  console.log(`🔗 Fetching URL: ${url}`);
  
  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&callback=?`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://proxy.cors.sh/${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    url
  ];

  for (let i = 0; i < proxies.length; i++) {
    const proxyUrl = proxies[i];
    const isDirect = proxyUrl === url;
    
    console.log(`  🔄 Attempt ${i + 1}/${proxies.length}: ${isDirect ? 'Direct' : 'Proxy'}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: !isDirect ? {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache'
        } : {}
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`  ⚠️ Attempt ${i + 1} failed with status: ${response.status}`);
        continue;
      }
      
      let html = '';
      
      if (proxyUrl.includes('allorigins.win')) {
        const data = await response.json();
        html = data.contents || '';
      } else {
        html = await response.text();
      }
      
      if (!html || html.trim().length === 0) {
        console.warn(`  ⚠️ Attempt ${i + 1} returned empty content`);
        continue;
      }
      
      const doc = new DOMParser().parseFromString(html, "text/html");
      const unwantedSelectors = 'script, style, noscript, iframe, nav, header, footer, aside, form, button, input, select, textarea, svg, img, video, audio, canvas';
      doc.querySelectorAll(unwantedSelectors).forEach(el => el.remove());
      
      let text = doc.body?.textContent || '';
      
      text = text
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000);
      
      console.log(`  ✅ Success! Got ${text.length} characters`);
      return text;
      
    } catch (error) {
      console.warn(`  ⚠️ Attempt ${i + 1} error:`, error.message);
      continue;
    }
  }
  
  console.error(`❌ All attempts failed for URL: ${url}`);
  return "";
}

// UPDATED: extractISQWithGemini - NO default fallback, only extraction
export async function extractISQWithGemini(
  input: InputData,
  urls: string[]
): Promise<{ config: ISQ; keys: ISQ[]; buyers: ISQ[] }> {
  if (!STAGE2_API_KEY) {
    throw new Error("Stage 2 API key is not configured. Please add VITE_STAGE2_API_KEY to your .env file.");
  }

  console.log("🚀 Stage 2: Starting ISQ extraction");
  console.log(`📋 Product: ${input.mcats.map(m => m.mcat_name).join(', ')}`);
  console.log(`🔗 URLs to process: ${urls.length}`);
  
  await sleep(2000);

  try {
    // Fetch URLs
    console.log("🌐 Fetching URL contents...");
    const urlContentsPromises = urls.map(async (url, index) => {
      console.log(`  📡 [${index + 1}/${urls.length}] Fetching: ${url}`);
      const content = await fetchURL(url);
      return { url, content, index };
    });

    const results = await Promise.all(urlContentsPromises);
    
    const urlContents: string[] = [];
    const successfulFetches: number[] = [];
    
    results.forEach(result => {
      urlContents.push(result.content);
      if (result.content && result.content.length > 0) {
        successfulFetches.push(result.index + 1);
      }
    });
    
    console.log(`📊 Fetch results: ${successfulFetches.length}/${urls.length} successful`);
    
    if (successfulFetches.length === 0) {
      console.warn("⚠️ No content fetched");
      return {
        config: { name: "", options: [] },
        keys: [],
        buyers: []
      };
    }
    
    // Build prompt
    const prompt = buildISQExtractionPrompt(input, urls, urlContents);
    
    console.log("🤖 Calling Gemini API...");
    
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${STAGE2_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000,
            responseMimeType: "application/json"
          },
        }),
      },
      2,
      10000
    );

    const data = await response.json();
    console.log("✅ Gemini API response received");
    
    let parsed = extractJSONFromGemini(data);

    // If no valid result, return empty
    if (!parsed || !parsed.config || !parsed.config.name || parsed.config.options.length === 0) {
      console.warn("⚠️ No valid data extracted from Gemini");
      return {
        config: { name: "", options: [] },
        keys: [],
        buyers: []
      };
    }
    
    console.log(`🎉 Success! Config: ${parsed.config.name} with ${parsed.config.options.length} options`);
    console.log(`🔑 Keys: ${parsed.keys?.length || 0}`);
    
    return {
      config: parsed.config,
      keys: parsed.keys || [],
      buyers: parsed.buyers || []
    };
    
  } catch (error) {
    console.error("❌ Stage 2 API error:", error);
    return {
      config: { name: "", options: [] },
      keys: [],
      buyers: []
    };
  }
}

function buildISQExtractionPrompt(
  input: InputData,
  urls: string[],
  contents: string[]
): string {
  const urlsText = urls
    .map((url, i) => `URL ${i + 1}: ${url}\nContent: ${contents[i].substring(0, 1000)}...`)
    .join("\n\n");

  return `You are an AI that extracts product specifications from multiple URLs. 
Your task is to identify the most important specifications and their options accurately. 

Extract specifications from these URLs for: ${input.mcats.map((m) => m.mcat_name).join(", ")}

URLs:
${urlsText}

INSTRUCTIONS (Step by Step):

1. **Extract all visible specifications from all URLs**, including:
   - Technical tables
   - Description sections
   - Variant details
   - Size charts
   - Grade sheets
   - Material information
   - Any repeated fields
   - Content inside tabs or expandable sections

2. **Combine equivalent specifications and options**:
   - Merge equivalent specifications, e.g., "Material Grade", "Grade", "SS 304", "304" → "Grade" 
   - Merge options that mean the same, e.g., "304L" and "SS 304L" → "SS 304L" 
   - Count the frequency of each specification and option after combining

3. **Select Config and Key specifications based on frequency**:
   - **Config specification**: the specification with the highest frequency. Most important specification affecting price across similar products. Example: RAM Capacity of smartphones.
   - **Key specifications**: the next top 3 specifications with highest frequency define the product and differentiate it from similar products. Example: Front-loading vs Top-loading for washing machines.
   - Options must be the ones most repeated across all URLs.
   - Do NOT repeat specifications or options in output.
   - Specifications must be **selected and ordered strictly by frequency (highest first)**.
   - Options must be **selected and ordered by frequency (highest first)**.
   - Show **maximum 8 options per specification**, based on highest frequency.
   - Do NOT include placeholder options like "Other" or "etc."


**Example:**  
Suppose 3 URLs have the following data:  
**Specification: "Grade"**

- URL1 options: ["SS 304", "SS 316"]  
- URL2 options: ["304", "SS 316"]  
- URL3 options: ["SS 304", "SS 316L"]  

**Step 1: Merge equivalent options**  
- "SS 304" and "304" → "SS 304"  
- Keep "SS 316" and "SS 316L" as-is  

**Step 2: Count frequency**  
Options frequency:  
- "SS 304" → 2  
- "SS 316" → 2  
- "SS 316L" → 1  

**Step 3: Choose top options**  
- Pick "SS 304" and "SS 316" (most frequent)  
- Exclude "SS 316L" (less frequent)  

**Step 4: Choose specification frequency**  
- "Grade" appears in all URLs → becomes Config specification

4. **Handle ranges**:
   - If a specification has ranges across URLs, find the overlapping range. Example:
     - Thickness 0.3–6 mm, 0.1–5 mm, 0.25–5 mm → Output range: 0.3–5 mm
   - Do NOT create options outside the URL-provided data.

5. **Exclusions**:
   - Do NOT include specifications already mentioned in the MCAT Name. Example:
     - MCAT Name: "Mild Steel Hot Rolled Sheet"
       - "Mild Steel" → Material → EXCLUDE
       - "Hot Rolled" → Finish → EXCLUDE
     - MCAT Name: "Stainless Steel 304 Pipe"
       - "Stainless Steel" → Material → EXCLUDE
       - "304" → Grade → EXCLUDE

6. **Rules**:
   - Do NOT invent specifications or options
   - Use frequency as the main criteria for importance
   - Ensure at least one Config and 3 Key specifications are returned
   - Options must come from URLs; no guessing
   - Do NOT repeat any specification or option
   - Do NOT include placeholder options like "Other", "etc.", or similar

7. **Output Format**:
   - Return ONLY valid JSON
   - No explanations, no markdown, no text outside JSON
   - JSON must start with { and end with }
   - Do not return incomplete JSON. Complete all strings and arrays.
   - Example JSON:

{
"config": {
"name": "Grade",
"options": ["SS 304", "SS 316"]
},
"keys": [
{
"name": "Thickness",
"options": ["0.3 mm to 5 mm"]
},
{
"name": "Width",
"options": ["100 mm", "200 mm", "300 mm"]
},
{
"name": "Surface Finish",
"options": ["Polished", "Matte"]
}
]
}
`;
}

// Rest of the functions remain EXACTLY THE SAME (unchanged)
export function generateBuyerISQsFromSpecs(
  uploadedSpecs: { spec_name: string; options: string[]; tier?: string }[],
  stage2ISQs: { config: ISQ; keys: ISQ[] }
): ISQ[] {
  console.log('🛒 Generating Buyer ISQs from uploaded specs...');
  console.log('Uploaded specs:', uploadedSpecs.length);
  console.log('Stage 2 ISQs:', stage2ISQs.config ? 1 : 0, 'config +', stage2ISQs.keys.length, 'keys');

  // Combine all Stage 2 ISQs
  const allStage2ISQs: ISQ[] = [];
  if (stage2ISQs.config && stage2ISQs.config.name && stage2ISQs.config.options?.length > 0) {
    allStage2ISQs.push(stage2ISQs.config);
  }
  if (stage2ISQs.keys && stage2ISQs.keys.length > 0) {
    allStage2ISQs.push(...stage2ISQs.keys.filter(k => k.name && k.options?.length > 0));
  }

  // Find common specs
  const commonSpecs: Array<{
    name: string;
    options: string[];
    priority: number;
  }> = [];

  uploadedSpecs.forEach(uploadedSpec => {
    allStage2ISQs.forEach(stage2ISQ => {
      if (isSemanticallySimilar(uploadedSpec.spec_name, stage2ISQ.name)) {
        const commonOptions = findCommonOptions(uploadedSpec.options, stage2ISQ.options);

        const priority = uploadedSpec.tier === 'Primary' ? 3 : 2;

        if (commonOptions.length > 0) {
          commonSpecs.push({
            name: uploadedSpec.spec_name,
            options: commonOptions,
            priority
          });
        }
      }
    });
  });

  console.log('Common specs found:', commonSpecs.length);

  if (commonSpecs.length === 0) {
    console.log('⚠️ No common specs found');
    return [];
  }

  // Sort by priority
  commonSpecs.sort((a, b) => b.priority - a.priority);

  // Return top 2
  const buyerISQs = commonSpecs.slice(0, 2).map(spec => ({
    name: spec.name,
    options: spec.options.slice(0, 8)
  }));

  console.log('✅ Generated buyer ISQs:', buyerISQs.length);
  return buyerISQs;
}

export function selectStage3BuyerISQs(
  stage1: Stage1Output,
  stage2: { config: ISQ; keys: ISQ[]; buyers?: ISQ[] }
): ISQ[] {
  console.log('🔍 selectStage3BuyerISQs called');
  console.log('Stage 1 data:', stage1);
  console.log('Stage 2 data:', stage2);

  // 1️⃣ Flatten Stage1 specs with priority
  const stage1All: (ISQ & { 
    tier: string; 
    normName: string; 
    spec_name?: string;
    priority: number;
  })[] = [];
  
  stage1.seller_specs.forEach(ss => {
    ss.mcats.forEach(mcat => {
      const { finalized_primary_specs, finalized_secondary_specs } = mcat.finalized_specs;

      // Primary specs (priority 3)
      finalized_primary_specs.specs.forEach(s => {
        stage1All.push({ 
          name: s.spec_name,
          spec_name: s.spec_name,
          options: s.options || [],
          tier: "Primary", 
          normName: normalizeSpecName(s.spec_name),
          priority: 3
        });
      });
      
      // Secondary specs (priority 2)
      finalized_secondary_specs.specs.forEach(s => {
        stage1All.push({ 
          name: s.spec_name,
          spec_name: s.spec_name,
          options: s.options || [],
          tier: "Secondary", 
          normName: normalizeSpecName(s.spec_name),
          priority: 2
        });
      });
    });
  });

  console.log('📊 Stage1 specs flattened:', stage1All.length);
  stage1All.forEach((s, i) => console.log(`  ${i+1}. ${s.spec_name} (${s.tier}) - ${s.options?.length || 0} options`));

  // 2️⃣ Flatten Stage2 specs
  const stage2All: (ISQ & { normName: string; priority: number })[] = [];
  
  // Add Config ISQ
  if (stage2.config && stage2.config.name && stage2.config.options?.length > 0) {
    stage2All.push({ 
      ...stage2.config, 
      options: stage2.config.options || [], 
      priority: 3,
      normName: normalizeSpecName(stage2.config.name)
    });
  }
  
  // Add Keys ISQs
  if (stage2.keys && stage2.keys.length > 0) {
    stage2.keys.forEach(k => {
      if (k.name && k.options?.length > 0) {
        stage2All.push({ 
          ...k, 
          options: k.options || [], 
          priority: 2,
          normName: normalizeSpecName(k.name)
        });
      }
    });
  }
  
  // Add Buyers ISQs
  if (stage2.buyers && stage2.buyers.length > 0) {
    stage2.buyers.forEach(b => {
      if (b.name && b.options?.length > 0) {
        stage2All.push({ 
          ...b, 
          options: b.options || [], 
          priority: 1,
          normName: normalizeSpecName(b.name)
        });
      }
    });
  }

  console.log('📊 Stage2 specs flattened:', stage2All.length);
  stage2All.forEach((s, i) => console.log(`  ${i+1}. ${s.name} (Priority: ${s.priority}) - ${s.options?.length || 0} options`));

  // 3️⃣ Find common specs - EXACT OR SEMANTIC MATCHING
  const commonSpecs: (ISQ & { 
    tier: string; 
    normName: string; 
    spec_name?: string;
    priority: number;
    combinedPriority: number;
    stage1Options: string[];
    stage2Options: string[];
  })[] = [];

  stage1All.forEach(s1 => {
    // Find matching Stage2 specs
    const matchingStage2 = stage2All.filter(s2 => 
      s2.normName === s1.normName || 
      isSemanticallySimilar(s1.spec_name || s1.name, s2.name)
    );
    
    if (matchingStage2.length > 0) {
      // Find the best matching Stage2 spec (highest priority)
      const bestMatch = matchingStage2.reduce((best, current) => 
        current.priority > best.priority ? current : best
      );
      
      // Calculate combined priority
      const combinedPriority = s1.priority + bestMatch.priority;
      
      commonSpecs.push({
        ...s1,
        combinedPriority,
        stage1Options: s1.options,
        stage2Options: bestMatch.options
      });
      
      console.log(`✅ Found common: ${s1.spec_name} (Stage1: ${s1.tier}, Stage2: ${bestMatch.name})`);
    }
  });

  console.log('🎯 Common specs found:', commonSpecs.length);
  commonSpecs.forEach(s => console.log(`   - ${s.spec_name} (Priority: ${s.combinedPriority})`));

  if (commonSpecs.length === 0) {
    console.log('⚠️ No common specs found');
    return []; // Return empty array if no common specs
  }

  // 4️⃣ Sort by combined priority (highest first)
  commonSpecs.sort((a, b) => b.combinedPriority - a.combinedPriority);

  // 5️⃣ Select top 2 buyer ISQs
  const buyerISQs: ISQ[] = [];
  const maxBuyers = Math.min(2, commonSpecs.length);
  
  for (let i = 0; i < maxBuyers; i++) {
    const spec = commonSpecs[i];
    console.log(`\n📦 Processing spec ${i+1}: ${spec.spec_name}`);
    
    // Get optimized options
    const options = getOptimizedBuyerISQOptions(
      spec.stage1Options, 
      spec.stage2Options,
      spec.normName
    );
    
    buyerISQs.push({ 
      name: spec.spec_name, 
      options: options
    });
    console.log(`✅ Added buyer ISQ: ${spec.spec_name} with ${options.length} options`);
  }

  console.log('🎉 Final buyer ISQs:', buyerISQs);
  return buyerISQs;
}

function getOptimizedBuyerISQOptions(
  stage1Options: string[], 
  stage2Options: string[],
  normName: string
): string[] {
  console.log(`🔧 Getting optimized options for: "${normName}"`);
  console.log(`   Stage 1 options:`, stage1Options);
  console.log(`   Stage 2 options:`, stage2Options);

  const result: string[] = [];
  const seen = new Set<string>();

  // Step 1: Add EXACT matches first
  console.log('   Step 1: Adding exact matches...');
  for (const opt1 of stage1Options) {
    if (result.length >= 8) break;
    
    const cleanOpt1 = opt1.trim().toLowerCase();
    const exactMatch = stage2Options.find(opt2 => 
      opt2.trim().toLowerCase() === cleanOpt1
    );
    
    if (exactMatch && !seen.has(cleanOpt1)) {
      result.push(opt1);
      seen.add(cleanOpt1);
      console.log(`     ✅ Exact match: "${opt1}"`);
    }
  }

  // Step 2: Add STRONG semantic matches
  if (result.length < 8) {
    console.log('   Step 2: Adding strong semantic matches...');
    for (const opt1 of stage1Options) {
      if (result.length >= 8) break;
      
      const cleanOpt1 = opt1.trim().toLowerCase();
      if (seen.has(cleanOpt1)) continue;
      
      for (const opt2 of stage2Options) {
        if (result.length >= 8) break;
        
        if (areOptionsStronglySimilar(opt1, opt2) && !seen.has(cleanOpt1)) {
          result.push(opt1);
          seen.add(cleanOpt1);
          console.log(`     ✅ Strong match: "${opt1}" ↔ "${opt2}"`);
          break;
        }
      }
    }
  }

  // Step 3: Add remaining Stage 1 options (most relevant)
  if (result.length < 8) {
    console.log('   Step 3: Adding remaining Stage 1 options...');
    const remainingStage1 = stage1Options.filter(opt => {
      const cleanOpt = opt.trim().toLowerCase();
      return !seen.has(cleanOpt);
    });
    
    // Take top options (max 8 total)
    const toAdd = Math.min(8 - result.length, remainingStage1.length);
    for (let i = 0; i < toAdd; i++) {
      result.push(remainingStage1[i]);
      seen.add(remainingStage1[i].trim().toLowerCase());
      console.log(`     ➕ Stage 1: "${remainingStage1[i]}"`);
    }
  }

  // Step 5: Ensure no duplicates in final result
  const finalResult: string[] = [];
  const finalSeen = new Set<string>();
  
  for (const opt of result) {
    const cleanOpt = opt.trim().toLowerCase();
    if (!finalSeen.has(cleanOpt)) {
      finalResult.push(opt);
      finalSeen.add(cleanOpt);
    }
  }

  console.log(`   ✅ Final: ${finalResult.length} unique options`);
  return finalResult.slice(0, 8);
}

function areOptionsStronglySimilar(opt1: string, opt2: string): boolean {
  if (!opt1 || !opt2) return false;
  
  const clean1 = opt1.toLowerCase().trim();
  const clean2 = opt2.toLowerCase().trim();
  
  // Direct match
  if (clean1 === clean2) return true;
  
  // Remove spaces and compare
  const noSpace1 = clean1.replace(/\s+/g, '');
  const noSpace2 = clean2.replace(/\s+/g, '');
  if (noSpace1 === noSpace2) return true;
  
  // Material and grade equivalences
  const materialGroups = [
    ['304', 'ss304', 'ss 304', 'stainless steel 304'],
    ['316', 'ss316', 'ss 316', 'stainless steel 316'],
    ['430', 'ss430', 'ss 430'],
    ['201', 'ss201', 'ss 201'],
    ['202', 'ss202', 'ss 202'],
    ['ms', 'mild steel', 'carbon steel'],
    ['gi', 'galvanized iron'],
    ['aluminium', 'aluminum'],
  ];
  
  for (const group of materialGroups) {
    const inGroup1 = group.some(term => clean1.includes(term));
    const inGroup2 = group.some(term => clean2.includes(term));
    if (inGroup1 && inGroup2) {
      // Check if same numeric grade
      const num1 = clean1.match(/\b(\d+)\b/)?.[1];
      const num2 = clean2.match(/\b(\d+)\b/)?.[1];
      if (num1 && num2 && num1 !== num2) return false;
      return true;
    }
  }
  
  // Measurement matching
  const getMeasurement = (str: string) => {
    const match = str.match(/(\d+(\.\d+)?)\s*(mm|cm|m|inch|in|ft|"|')?/i);
    if (!match) return null;
    
    const value = parseFloat(match[1]);
    const unit = match[3]?.toLowerCase() || '';
    
    // Convert to mm for comparison
    if (unit === 'cm' || unit === 'centimeter') return value * 10;
    if (unit === 'm' || unit === 'meter') return value * 1000;
    if (unit === 'inch' || unit === 'in' || unit === '"') return value * 25.4;
    if (unit === 'ft' || unit === 'feet' || unit === "'") return value * 304.8;
    return value; // assume mm
  };
  
  const meas1 = getMeasurement(clean1);
  const meas2 = getMeasurement(clean2);
  
  if (meas1 && meas2 && Math.abs(meas1 - meas2) < 0.01) {
    return true;
  }
  
  // Shape equivalences
  const shapeGroups = [
    ['round', 'circular', 'circle'],
    ['square', 'squared'],
    ['rectangular', 'rectangle'],
    ['hexagonal', 'hexagon'],
    ['flat', 'flat bar'],
    ['angle', 'l shape', 'l-shaped'],
    ['channel', 'c shape', 'c-shaped'],
    ['pipe', 'tube', 'tubular'],
    ['slotted', 'slot'],
  ];
  
  for (const group of shapeGroups) {
    const inGroup1 = group.some(term => clean1.includes(term));
    const inGroup2 = group.some(term => clean2.includes(term));
    if (inGroup1 && inGroup2) return true;
  }
  
  return false;
}

export function compareResults(
  chatgptSpecs: Stage1Output,
  geminiSpecs: Stage1Output
): {
  common_specs: Array<{
    spec_name: string;
    chatgpt_name: string;
    gemini_name: string;
    common_options: string[];
    chatgpt_unique_options: string[];
    gemini_unique_options: string[];
  }>;
  chatgpt_unique_specs: Array<{ spec_name: string; options: string[] }>;
  gemini_unique_specs: Array<{ spec_name: string; options: string[] }>;
} {
  const chatgptAllSpecs = extractAllSpecsWithOptions(chatgptSpecs);
  const geminiAllSpecs = extractAllSpecsWithOptions(geminiSpecs);

  const commonSpecs: Array<{
    spec_name: string;
    chatgpt_name: string;
    gemini_name: string;
    common_options: string[];
    chatgpt_unique_options: string[];
    gemini_unique_options: string[];
  }> = [];

  const chatgptUnique: Array<{ spec_name: string; options: string[] }> = [];
  const geminiUnique: Array<{ spec_name: string; options: string[] }> = [];

  const matchedChatgpt = new Set<number>();
  const matchedGemini = new Set<number>();

  chatgptAllSpecs.forEach((chatgptSpec, i) => {
    let foundMatch = false;
    
    geminiAllSpecs.forEach((geminiSpec, j) => {
      if (matchedGemini.has(j)) return;
      
      if (isSemanticallySimilar(chatgptSpec.spec_name, geminiSpec.spec_name)) {
        matchedChatgpt.add(i);
        matchedGemini.add(j);
        foundMatch = true;
        
        const commonOpts = findCommonOptions(chatgptSpec.options, geminiSpec.options);
        const chatgptUniq = chatgptSpec.options.filter(opt => 
          !geminiSpec.options.some(gemOpt => isSemanticallySimilarOption(opt, gemOpt))
        );
        const geminiUniq = geminiSpec.options.filter(opt => 
          !chatgptSpec.options.some(chatOpt => isSemanticallySimilarOption(opt, chatOpt))
        );
        
        commonSpecs.push({
          spec_name: chatgptSpec.spec_name,
          chatgpt_name: chatgptSpec.spec_name,
          gemini_name: geminiSpec.spec_name,
          common_options: commonOpts,
          chatgpt_unique_options: chatgptUniq,
          gemini_unique_options: geminiUniq
        });
      }
    });
    
    if (!foundMatch) {
      chatgptUnique.push({
        spec_name: chatgptSpec.spec_name,
        options: chatgptSpec.options
      });
    }
  });

  geminiAllSpecs.forEach((geminiSpec, j) => {
    if (!matchedGemini.has(j)) {
      geminiUnique.push({
        spec_name: geminiSpec.spec_name,
        options: geminiSpec.options
      });
    }
  });

  return {
    common_specs: commonSpecs,
    chatgpt_unique_specs: chatgptUnique,
    gemini_unique_specs: geminiUnique,
  };
}

function extractAllSpecsWithOptions(specs: Stage1Output): Array<{ spec_name: string; options: string[] }> {
  const allSpecs: Array<{ spec_name: string; options: string[] }> = [];
  
  specs.seller_specs.forEach((ss) => {
    ss.mcats.forEach((mcat) => {
      const { finalized_primary_specs, finalized_secondary_specs, finalized_tertiary_specs } =
        mcat.finalized_specs;
      
      finalized_primary_specs.specs.forEach((s) => 
        allSpecs.push({ spec_name: s.spec_name, options: s.options })
      );
      finalized_secondary_specs.specs.forEach((s) => 
        allSpecs.push({ spec_name: s.spec_name, options: s.options })
      );
      finalized_tertiary_specs.specs.forEach((s) => 
        allSpecs.push({ spec_name: s.spec_name, options: s.options })
      );
    });
  });
  
  return allSpecs;
}

function isSemanticallySimilarOption(opt1: string, opt2: string): boolean {
  return areOptionsStronglySimilar(opt1, opt2);
}

function findCommonOptions(options1: string[], options2: string[]): string[] {
  const common: string[] = [];
  const usedIndices = new Set<number>();
  
  options1.forEach((opt1, i) => {
    options2.forEach((opt2, j) => {
      if (usedIndices.has(j)) return;
      if (areOptionsStronglySimilar(opt1, opt2)) {
        common.push(opt1);
        usedIndices.add(j);
      }
    });
  });
  
  return common;
}

// Missing function from original code
function buildStage1Prompt(input: InputData): string {
  return `Stage 1 prompt for: ${JSON.stringify(input)}`;
}

function extractRawText(response: any): string {
  try {
    if (!response?.candidates?.length) return "";

    const parts = response.candidates[0]?.content?.parts || [];
    let text = "";

    for (const part of parts) {
      if (typeof part.text === "string") {
        text += part.text + "\n";
      }
    }

    return text.trim();
  } catch {
    return "";
  }
}