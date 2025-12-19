import Papa from 'papaparse';
import JSZip from 'jszip';
import { Category } from '../types';

// ---------------------------
// Constants & Configuration
// ---------------------------

const TEMPLATE_COLS = [
  "Title", "URL handle", "Description", "Vendor", "Product category", "Type", "Tags",
  "Published on online store", "Status", "SKU", "Barcode",
  "Option1 name", "Option1 value", "Option2 name", "Option2 value", "Option3 name", "Option3 value",
  "Price", "Compare-at price", "Cost per item", "Charge tax", "Tax code",
  "Unit price total measure", "Unit price total measure unit", "Unit price base measure", "Unit price base measure unit",
  "Inventory tracker", "Variant Inventory Policy", "Inventory policy",
  "Continue selling when out of stock", "Inventory quantity",
  "Weight value (grams)", "Weight unit for display", "Requires shipping", "Fulfillment service",
  "Product image URL", "Image position", "Image alt text", "Variant image URL", "Gift card",
  "SEO title", "SEO description",
  "Google Shopping / Google product category", "Google Shopping / Gender", "Google Shopping / Age group",
  "Google Shopping / MPN", "Google Shopping / AdWords Grouping", "Google Shopping / AdWords labels",
  "Google Shopping / Condition", "Google Shopping / Custom product",
  "Google Shopping / Custom label 0", "Google Shopping / Custom label 1",
  "Google Shopping / Custom label 2", "Google Shopping / Custom label 3", "Google Shopping / Custom label 4",
  // Optional extra cols
  "Fabric", "Wash Care", "Material", "Shelf", "Test", 
  "Variant Image", "Variant Weight Unit", "Variant Tax Code", "Shelf No", "Sizes"
];

// ---------------------------
// Helper Functions (Ported)
// ---------------------------

const slugify = (text: string): string => {
  let t = (text || "").trim().toLowerCase();
  t = t.replace(/[^a-z0-9\s-]/g, "");
  t = t.replace(/\s+/g, "-");
  t = t.replace(/-+/g, "-");
  return t.replace(/^-|-$/g, "");
};

const detectHeaderRow = (data: any[][], maxRows: number = 8): number => {
  for (let i = 0; i < Math.min(maxRows, data.length); i++) {
    const rowVals = data[i].map(x => String(x || "").trim().toLowerCase());
    if (rowVals.some(v => v === "title" || v.includes("title"))) {
      return i;
    }
  }
  return 0;
};

const cleanPrice = (x: any): string => {
  if (x === null || x === undefined) return "";
  const s = String(x).trim();
  if (s === "") return "";
  
  // Keep digits, dots, dashes
  let s2 = "";
  for (const char of s) {
    if (/[0-9.-]/.test(char)) s2 += char;
  }
  
  if (s2 === "") return "";
  try {
    // Check if it's essentially an integer
    const f = parseFloat(s2);
    if (Number.isInteger(f)) return String(f);
    return s2; // Return original cleaned string if decimal
  } catch {
    return s2;
  }
};

const roundToNearest9 = (priceStr: string): string => {
  if (!priceStr || priceStr.trim() === "") return "";
  try {
    const priceFloat = parseFloat(priceStr);
    if (isNaN(priceFloat) || priceFloat <= 0) return priceStr;
    
    // Round to nearest 10 (using round half up logic), then subtract 1
    // Math.round(x/10)*10 is standard, but Python logic was int((x+5)/10)*10 - 1
    const rounded = Math.floor((priceFloat + 5) / 10) * 10 - 1;
    
    return String(Math.max(0, rounded));
  } catch {
    return priceStr;
  }
};

const findColByNames = (cols: string[], names: string[]): string | null => {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const colsNorm: Record<string, string> = {};
  
  cols.forEach(c => {
    colsNorm[normalize(c)] = c;
  });

  // Exact match on normalized
  for (const name of names) {
    const key = normalize(name);
    if (colsNorm[key]) return colsNorm[key];
  }

  // Fallback: Substring match
  for (const name of names) {
    const needle = name.toLowerCase().replace(/\s/g, "");
    for (const c of cols) {
      if (c.toLowerCase().replace(/\s/g, "").includes(needle)) {
        return c;
      }
    }
  }
  return null;
};

const detectImageColumns = (cols: string[]): string[] => {
  return cols.filter(c => {
    const lower = c.toLowerCase();
    return lower.includes("product image") || lower.includes("image") || lower.includes("image url");
  });
};

const detectSizeColumns = (cols: string[]): string[] => {
  const sizeCandidates = [
    "NB","0-2M","2-4M","4-6M","0-3M","3-6M","6-9M","6-12M","9-12M","12-18M","18-24M",
    "1-2Y","2-3Y","3-4Y","4-5Y","5-6Y","One Size","S","M","L","XL","XXL"
  ];
  
  const sizeCols: string[] = [];
  
  // Exactish match
  for (const c of cols) {
    const trimmed = c.trim();
    if (sizeCandidates.some(sc => new RegExp(`^\\s*${sc.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*$`, 'i').test(trimmed))) {
      sizeCols.push(c);
    }
  }

  // Fallback: headers ending in m or y digits
  for (const c of cols) {
    if (!sizeCols.includes(c)) {
      if (/\d+\s*[-]?\s*\d*\s*[my]$/i.test(c.trim())) {
        sizeCols.push(c);
      }
    }
  }
  
  return sizeCols;
};

const normalizeSizeForMatching = (sizeStr: string): string => {
  if (!sizeStr) return "";
  let normalized = String(sizeStr).toLowerCase().trim();
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.replace(/\s*-\s*/g, '-');
  normalized = normalized.replace(/\s*–\s*/g, '-');
  normalized = normalized.replace(/\s*—\s*/g, '-');
  normalized = normalized.replace(/ /g, '');
  return normalized;
};

interface AgeGroupConfig {
  tag: string;
  patterns: string[];
}

const getBoyAgeGroupTags = (variants: string[]): string[] => {
  const ageGroupTags: string[] = [];
  const normalizedVariants = variants
    .filter(v => v && v !== "Default")
    .map(normalizeSizeForMatching);

  const ageGroups: AgeGroupConfig[] = [
    { tag: "Boy 0-3m", patterns: ["nb", "0-2m", "2-4m", "0-3m", "0-6m"] },
    { tag: "Boy 3-6m", patterns: ["2-4m", "4-6m", "3-6m", "0-6m"] },
    { tag: "Boy 6-12m", patterns: ["6-9m", "6-12m", "9-12m", "0-12m"] },
    { tag: "Boy 1-2y", patterns: ["12-18m", "15-18m", "18-24m", "18m-3y", "1-2y", "1-3y"] },
    { tag: "Boy 2-3y", patterns: ["18m-3y", "1-3y", "2-3y", "2-4y", "2-2.5y", "2.5-3y"] },
    { tag: "Boy 3-4y", patterns: ["2-4y", "3-4y", "3-3.5y", "3.5-4y"] },
    { tag: "Boy 4-5y", patterns: ["3-4y", "4-5y", "5-6y", "5-7y", "4-4.5y", "4.5-5y"] },
    { tag: "Boy 5+ y", patterns: ["5-6y", "5-7y", "6-7y", "7-8y", "5-5.5y", "5.5-6y"] }
  ];

  for (const group of ageGroups) {
    for (const variant of normalizedVariants) {
      if (!variant) continue;
      for (const pattern of group.patterns) {
        if (pattern === variant || (pattern.length >= 3 && variant.includes(pattern))) {
          if (!ageGroupTags.includes(group.tag)) {
            ageGroupTags.push(group.tag);
          }
          break; // Break patterns loop
        }
      }
      if (ageGroupTags.includes(group.tag)) break; // Break variants loop
    }
  }
  return ageGroupTags;
};

const getGirlAgeGroupTags = (variants: string[]): string[] => {
  const ageGroupTags: string[] = [];
  const normalizedVariants = variants
    .filter(v => v && v !== "Default")
    .map(normalizeSizeForMatching);

  const ageGroups: AgeGroupConfig[] = [
    { tag: "Girl 0-3m", patterns: ["nb", "0-2m", "2-4m", "0-3m", "0-6m"] },
    { tag: "Girl 3-6m", patterns: ["2-4m", "24m", "4-6m", "3-6m", "0-6m"] },
    { tag: "Girl 6-12m", patterns: ["6-9m", "6-12m", "9-12m", "0-12m"] },
    { tag: "Girl 1-2y", patterns: ["12-18m", "15-18m", "18-24m", "18m-3y", "1-2y", "1-3y"] },
    { tag: "Girl 2-3y", patterns: ["18m-3y", "1-3y", "13y", "2-3y", "2-4y", "2-2.5y", "2.5-3y"] },
    { tag: "Girl 3-4y", patterns: ["2-4y", "3-4y", "3-3.5y", "3.5-4y"] },
    { tag: "Girl 4-5y", patterns: ["3-4y", "4-5y", "5-6y", "5-7y"] },
    { tag: "Girl 5+ y", patterns: ["5-6y", "5-7y", "6-7y", "7-8y"] }
  ];

  for (const group of ageGroups) {
    for (const variant of normalizedVariants) {
      if (!variant) continue;
      for (const pattern of group.patterns) {
        if (pattern === variant || (pattern.length >= 3 && variant.includes(pattern))) {
          if (!ageGroupTags.includes(group.tag)) {
            ageGroupTags.push(group.tag);
          }
          break;
        }
      }
      if (ageGroupTags.includes(group.tag)) break;
    }
  }
  return ageGroupTags;
};

// ---------------------------
// Main Logic
// ---------------------------

const processSingleFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // First parse to find header row (using header: false to get array of arrays)
    Papa.parse(file, {
      header: false,
      skipEmptyLines: false, // Need all lines to detect header index correctly relative to file start
      complete: (results) => {
        try {
          const rawData = results.data as any[][];
          if (!rawData || rawData.length === 0) {
            resolve("");
            return;
          }

          const headerRowIdx = detectHeaderRow(rawData);
          const headerRow = rawData[headerRowIdx].map(x => String(x || "").trim() || `unnamed_${Math.random()}`);
          
          // Slice data and convert to objects manually to avoid re-parsing
          const dataRows = rawData.slice(headerRowIdx + 1);
          
          // Map to objects based on detected header
          const df: Record<string, string>[] = dataRows.map(row => {
            const obj: Record<string, string> = {};
            headerRow.forEach((colName, idx) => {
              obj[colName] = row[idx] !== undefined ? String(row[idx]) : "";
            });
            return obj;
          });

          // --- Begin Processing Logic ---

          const cols = headerRow;
          
          // Column Mapping
          let titleCol = findColByNames(cols, ["Title", "Product Title", "Name"]);
          const brandCol = findColByNames(cols, ["Brand Name", "Vendor", "Brand"]);
          const prodcatCol = findColByNames(cols, ["Product category", "Category"]);
          let subcatCol = findColByNames(cols, ["Subcategory", "Sub Category", "Type"]);
          const subsubCol = findColByNames(cols, ["Sub Sub Category", "SubSubCategory"]);
          const seasonCol = findColByNames(cols, ["Season"]);
          const campaignCol = findColByNames(cols, ["Campaign"]);
          const sizesCol = findColByNames(cols, ["Sizes", "Size"]);
          const costCol = findColByNames(cols, ["Cost to Kiddo", "Cost"]);
          const mrpCol = findColByNames(cols, ["MRP"]);
          const finalCol = findColByNames(cols, ["Selling Price"]);
          const sizeChartCol = findColByNames(cols, ["Size chart", "Size Chart", "Sizechart"]);

          const imageCols = detectImageColumns(cols);
          const sizeCols = detectSizeColumns(cols);

          // Fallback title detection
          if (!titleCol) {
            for (const c of cols) {
              // check first 10 rows for non-numeric
              const sample = df.slice(0, 10).map(r => r[c] || "").filter(s => s && !/^\d+$/.test(s));
              if (sample.length > 0) {
                titleCol = c;
                break;
              }
            }
            if (!titleCol) titleCol = cols[0];
          }

          const optionalExtraCols = {
            "Fabric": ["Fabric", "Fabric (product.metafields.custom.fabric)"],
            "Wash Care": ["Wash Care", "Wash care", "Wash Care (product.metafields.custom.wash_care)"],
            "Material": ["Material", "Material (product.metafields.custom.material)"],
            "Shelf": ["Shelf", "Shelf (product.metafields.custom.shelf)"],
            "Test": ["Test", "Test (product.metafields.custom.test)"],
            "Variant Image": ["Variant Image", "Variant image"],
            "Variant Weight Unit": ["Variant Weight Unit", "Variant weight unit"],
            "Variant Tax Code": ["Variant Tax Code", "Variant tax code"],
            "Shelf No": ["Shelf No", "Shelf Number"],
            "Sizes": ["Sizes", "Size"]
          };

          const handleTemplateCol = "URL handle"; // Hardcoded matching TEMPLATE_COLS

          const outRows: any[] = [];

          df.forEach(row => {
            const title = String(row[titleCol!] || "").trim();
            if (!title || title.toLowerCase() === "nan") return;

            const handleBase = slugify(title);

            // Variants
            let variants: string[] = [];
            for (const sc of sizeCols) {
              const val = row[sc];
              if (val) {
                const sVal = String(val).trim();
                if (sVal && sVal !== "0" && sVal.toLowerCase() !== "nan") {
                  variants.push(sc.trim());
                }
              }
            }
            if (variants.length === 0) variants = ["Default"];

            // Images
            const images: string[] = [];
            for (const ic of imageCols) {
              const url = String(row[ic] || "").trim();
              if (url && url.toLowerCase() !== "nan" && !images.includes(url)) {
                images.push(url);
              }
            }
            if (sizeChartCol) {
               const url = String(row[sizeChartCol] || "").trim();
               if (url && url.toLowerCase() !== "nan" && !images.includes(url)) {
                 images.push(url);
               }
            }
            
            const primaryImage = images.length > 0 ? images[0] : "";

            // Prices
            const finalPrice = finalCol ? cleanPrice(row[finalCol]) : "";
            const mrpPrice = mrpCol ? cleanPrice(row[mrpCol]) : "";
            const costPrice = costCol ? cleanPrice(row[costCol]) : "";
            const fallbackPriceToCost = true; // Hardcoded true as per default arg in python script

            let firstVariant = true;

            for (const size of variants) {
               const out: Record<string, any> = {};
               TEMPLATE_COLS.forEach(c => out[c] = "");

               out["Title"] = title;
               out[handleTemplateCol] = handleBase;

               // Description
               const descParts: string[] = [];
               ["Product Specifcation", "Product Specification", "Product specification"].forEach(p => {
                 const colName = findColByNames(cols, [p]);
                 if (colName && row[colName]) {
                    const val = String(row[colName]).trim();
                    if(val) descParts.push(val);
                 }
               });
               out["Description"] = descParts.join("\n\n");

               // Optional Extras
               for (const [outColKey, candidates] of Object.entries(optionalExtraCols)) {
                  const sourceCol = findColByNames(cols, candidates);
                  if (sourceCol) {
                    out[outColKey] = String(row[sourceCol] || "").trim();
                  }
               }

               if (brandCol) out["Vendor"] = row[brandCol] || "";
               if (prodcatCol) out["Product category"] = row[prodcatCol] || "";
               if (subcatCol) out["Type"] = row[subcatCol] || (subsubCol ? row[subsubCol] : "");

               // Tags Generation
               const tags: string[] = [];
               if (brandCol) {
                 const v = String(row[brandCol] || "").trim();
                 if (v && v.toLowerCase() !== "nan") tags.push(v);
               }
               if (prodcatCol) {
                 const v = String(row[prodcatCol] || "").trim();
                 if (v && v.toLowerCase() !== "nan") tags.push(v);
               }
               if (subcatCol) {
                  const v = String(row[subcatCol] || "").trim();
                  if (v && v.toLowerCase() !== "nan") tags.push(v);
               }

               // Configured tag columns
               const tagColumns = [
                 { col: subsubCol, name: "Subcategory" }, // Python logic used subsubcategory here
                 { col: subsubCol, name: "Sub Sub Category" },
                 { col: seasonCol, name: "Season" },
                 { col: campaignCol, name: "Campaign" },
                 { col: sizesCol, name: "Sizes" }
               ];

               tagColumns.forEach(item => {
                 if (item.col) {
                   const val = String(row[item.col] || "").trim();
                   if (val && val.toLowerCase() !== "nan") tags.push(val);
                 }
               });

               // Boolean/Flag columns for tags (Boy, Girl, Unisex, NB)
               const isValueOne = (val: any) => {
                 if (val === null || val === undefined) return false;
                 const valStr = String(val).trim();
                 if (!valStr || valStr.toLowerCase() === "nan") return false;
                 return parseFloat(valStr) === 1.0;
               };

               cols.forEach(col => {
                 const colNorm = col.replace(/[*+\s]+/g, "").toLowerCase();
                 const val = row[col];
                 
                 if (!isValueOne(val)) return;

                 if (colNorm.includes("girls") && colNorm.includes("unisex")) {
                    if (!tags.includes("Girl")) tags.push("Girl");
                    if (!tags.includes("Unisex")) tags.push("Unisex");
                 } else if (colNorm.includes("boys") && colNorm.includes("unisex")) {
                    if (!tags.includes("Boy")) tags.push("Boy");
                    if (!tags.includes("Unisex")) tags.push("Unisex");
                 } else if (colNorm === "boy" || colNorm === "boys") {
                    if (!tags.includes("Boy")) tags.push("Boy");
                 } else if (colNorm === "girl" || colNorm === "girls") {
                    if (!tags.includes("Girl")) tags.push("Girl");
                 } else if (colNorm === "unisex") {
                    if (!tags.includes("Unisex")) tags.push("Unisex");
                 } else if (colNorm === "nb" || colNorm === "newborn") {
                    if (!tags.includes("Newborn")) tags.push("Newborn");
                 }
               });

               // Age Group Tags
               if (tags.includes("Boy")) {
                 const ageTags = getBoyAgeGroupTags(variants);
                 ageTags.forEach(t => { if(!tags.includes(t)) tags.push(t); });
               }
               if (tags.includes("Girl")) {
                 const ageTags = getGirlAgeGroupTags(variants);
                 ageTags.forEach(t => { if(!tags.includes(t)) tags.push(t); });
               }
               
               // Dedupe tags
               out["Tags"] = Array.from(new Set(tags)).join(", ");

               out["Published on online store"] = "TRUE";
               out["Status"] = "Active";

               out["Option1 name"] = size !== "Default" ? "Size" : "";
               out["Option1 value"] = size !== "Default" ? size : "";

               // Pricing
               let priceVal = "";
               if (finalPrice) {
                 priceVal = roundToNearest9(finalPrice);
               } else if (costPrice && fallbackPriceToCost) {
                 priceVal = roundToNearest9(costPrice);
               }
               out["Price"] = priceVal;
               out["Compare-at price"] = mrpPrice;
               out["Cost per item"] = costPrice;

               out["Charge tax"] = "TRUE";
               out["Requires shipping"] = "TRUE";
               out["Fulfillment service"] = "manual";
               out["Gift card"] = "FALSE";

               out["SEO title"] = title;
               out["SEO description"] = out["Description"] ? out["Description"].substring(0, 320) : "";
               if (prodcatCol) out["Google Shopping / Google product category"] = row[prodcatCol] || "";

               // Images (Primary on first variant)
               if (firstVariant && primaryImage) {
                 out["Product image URL"] = primaryImage;
                 out["Image position"] = 1;
                 firstVariant = false;
               }

               outRows.push(out);
            }

            // Extra Image Rows
            let pos = 2;
            for (let i = 1; i < images.length; i++) {
               const imgRow: Record<string, any> = {};
               TEMPLATE_COLS.forEach(c => imgRow[c] = "");
               imgRow[handleTemplateCol] = handleBase;
               imgRow["Product image URL"] = images[i];
               imgRow["Image position"] = pos;
               outRows.push(imgRow);
               pos++;
            }
          });

          const csv = Papa.unparse({
            fields: TEMPLATE_COLS,
            data: outRows
          });
          
          resolve(csv);

        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err)
    });
  });
};

export const processFiles = async (
  files: File[],
  category: Category
): Promise<Blob> => {
  const zip = new JSZip();

  const promises = files.map(async (file) => {
    try {
      const csvContent = await processSingleFile(file);
      // Construct filename: [OriginalName] - Converted - Shopify.csv
      // Remove original extension first
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const newName = `${nameWithoutExt} - Converted - Shopify.csv`;
      
      zip.file(newName, csvContent);
    } catch (error) {
      console.error(`Error processing file ${file.name}`, error);
      // We might want to add an error log file to the zip or just skip
      zip.file(`ERROR_${file.name}.txt`, `Failed to process: ${error}`);
    }
  });

  await Promise.all(promises);
  return await zip.generateAsync({ type: 'blob' });
};