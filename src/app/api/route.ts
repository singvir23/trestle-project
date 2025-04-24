// src/app/api/route.ts
import { NextRequest, NextResponse } from 'next/server';

// --- Type Definitions ---
interface TrestlePhoneOwnerPerson { type: "Person"; name: string | null; /* ... other fields */ }
interface TrestlePhoneOwnerBusiness { type: "Business"; name: string | null; industry?: string | null; /* ... other fields */ }
interface TrestleAddress { city?: string; state?: string; [key: string]: string | undefined; }
interface TrestleCallerIdResponse {
    id: string | null; phone_number: string | null; is_valid: boolean | null;
    line_type: string | null; carrier: string | null; is_prepaid: boolean | null;
    is_commercial: boolean | null; belongs_to: TrestlePhoneOwnerPerson | TrestlePhoneOwnerBusiness | null;
    current_addresses: TrestleAddress[] | null; emails: string | string[] | null;
    error?: { message?: string }; warnings?: string[];
}
interface KeyPersonnel {
    name: string;
    title: string;
    linkedInUrl: string | null;
    profileSummary: string | null;
}
interface SalesInsightReport {
    status: 'success' | 'no_business_found' | 'error' | 'not_attempted';
    companyName: string | null; website: string | null; industry: string | null; location: string | null;
    companySize: string | null;
    keyPersonnel: KeyPersonnel[] | null;
    companyOverview: string | null; productsServices: string | null; targetAudience: string | null;
    recentNewsTrigger: string | null; potentialPainPoints: string[] | null; techStackHints: string[] | null;
    conversationStarters: string[] | null; aiConfidenceScore: 'High' | 'Medium' | 'Low' | null;
    researchTimestamp: string | null; researchSources?: string[]; error?: string; message?: string;
}
interface CombinedResult {
    trestleData: TrestleCallerIdResponse | null;
    salesInsightReport: SalesInsightReport;
}
interface ApiErrorResponse {
    error: string; details?: string; trestleStatus?: number;
    perplexityError?: boolean;
}

// --- Helper Function: Extract Area Code ---
function getAreaCode(phoneNumber: string): string | null {
    if (!phoneNumber) return null;
    const cleanedPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits

    // Handle US/Canada numbers (potentially with country code)
    if (cleanedPhone.length === 10) {
        return cleanedPhone.substring(0, 3);
    } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
        return cleanedPhone.substring(1, 4);
    }
    // Add more specific rules for other country codes if needed
    return null; // Return null if format is unexpected
}


// --- API Route Handler ---
export async function POST(request: NextRequest) {
    const TRESTLE_API_KEY = process.env.TRESTLE_API_KEY;
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

    if (!TRESTLE_API_KEY) {
        console.error("Trestle API Key missing.");
        return NextResponse.json({ error: 'Server configuration error: Missing Trestle API Key.' } satisfies ApiErrorResponse, { status: 500 });
    }
    if (!PERPLEXITY_API_KEY) {
        console.error("Perplexity API Key missing.");
        return NextResponse.json({ error: 'Server configuration error: Missing Perplexity API Key.' } satisfies ApiErrorResponse, { status: 500 });
    }

    let trestleData: TrestleCallerIdResponse | null = null;
    let salesInsightReport: SalesInsightReport = {
        status: 'not_attempted', companyName: null, website: null, industry: null, location: null,
        companySize: null, keyPersonnel: null, companyOverview: null, productsServices: null,
        targetAudience: null, recentNewsTrigger: null, potentialPainPoints: null, techStackHints: null,
        conversationStarters: null, aiConfidenceScore: null, researchTimestamp: null,
        message: 'Processing not started.',
    };

    try {
        const body = await request.json();
        const phone: string | undefined = body.phone;

        if (!phone || typeof phone !== 'string' || !phone.trim()) {
            return NextResponse.json({ error: 'Valid phone number (string) is required.' } satisfies ApiErrorResponse, { status: 400 });
        }

        // *** Extract Area Code early ***
        const areaCodeHint = getAreaCode(phone);
        if (areaCodeHint) {
             console.log(`Extracted Area Code Hint: ${areaCodeHint}`);
        } else {
             console.warn(`Could not extract standard area code from phone: ${phone}`);
        }

        // --- 1. Call Trestle API ---
        const trestleUrl = `https://api.trestleiq.com/3.1/caller_id?phone=${encodeURIComponent(phone)}`;
        console.log(`Calling Trestle: ${trestleUrl}`);
        const trestleResponse = await fetch(trestleUrl, {
            method: 'GET',
            headers: { 'x-api-key': TRESTLE_API_KEY, 'Accept': 'application/json' }
        });
        console.log(`Trestle Status: ${trestleResponse.status}`);
        if (!trestleResponse.ok) {
             let errorBody: string | Record<string, unknown> = `Trestle API request failed with status ${trestleResponse.status}`;
             try { errorBody = await trestleResponse.json(); } catch {} /* Ignore parsing error */
             console.error("Trestle API Error:", errorBody);
             salesInsightReport = {
                ...salesInsightReport,
                status: 'error',
                error: 'Failed to retrieve initial data from Trestle.',
                message: `Data source error: ${trestleResponse.statusText || trestleResponse.status}`,
             };
             const combinedResult: CombinedResult = { trestleData: null, salesInsightReport };
             return NextResponse.json(combinedResult, { status: 200 });
        }
        trestleData = await trestleResponse.json() as TrestleCallerIdResponse;
        console.log("Trestle Data Received");

        // --- 2. Check if it's likely a Business Number ---
        const isBusiness = trestleData?.is_commercial === true || trestleData?.belongs_to?.type === 'Business';
        let businessName: string | null = null;
        let industryHint: string | null = null;
        let trestleLocationHint: string | null = null; // Specific variable for Trestle location

        if (isBusiness && trestleData?.belongs_to?.type === 'Business') {
            businessName = trestleData.belongs_to.name;
            industryHint = trestleData.belongs_to.industry ?? null;
        } else if (trestleData?.is_commercial === true && trestleData?.belongs_to?.name) {
            businessName = trestleData.belongs_to.name;
        }

        // Extract Trestle location hint
        if (trestleData?.current_addresses && trestleData.current_addresses.length > 0) {
            const addr = trestleData.current_addresses[0];
            if (addr?.city && addr?.state) trestleLocationHint = `${addr.city}, ${addr.state}`;
            else if (addr?.city) trestleLocationHint = addr.city;
            else if (addr?.state) trestleLocationHint = addr.state;
             console.log(`Extracted Trestle Location Hint: ${trestleLocationHint}`);
        }

        // --- 3. Proceed to Perplexity Research IF Business Info Found ---
        if (businessName) {
            console.log(`Identified as business: "${businessName}". Preparing Perplexity request.`);

             // *** Construct the location part of the prompt ***
             let locationPromptPart = '';
             if (trestleLocationHint && areaCodeHint) {
                 // Combine both if available
                 locationPromptPart = `potentially located near "${trestleLocationHint}" (Area Code: ${areaCodeHint})`;
             } else if (trestleLocationHint) {
                 // Use only Trestle hint if area code is missing
                 locationPromptPart = `potentially located near "${trestleLocationHint}"`;
             } else if (areaCodeHint) {
                 // Use only area code hint if Trestle location is missing
                 locationPromptPart = `potentially in Area Code ${areaCodeHint}`;
             }
             // If neither is available, locationPromptPart remains empty

            // *** Define the prompt (UPDATED with locationPromptPart) ***
            const prompt = `
You are a sales intelligence researcher performing web searches to gather information.
Research the company named "${businessName}" ${industryHint ? `in the industry "${industryHint}"` : ''} ${locationPromptPart ? locationPromptPart : 'with an unknown location'}.

Provide your findings STRICTLY in the following JSON format.
- Prefer verified sources like the official company website, LinkedIn company pages, reputable news outlets, Crunchbase, government (.gov), or educational (.edu) sites when possible for facts like company size, key personnel, and recent news.
- For 'keyPersonnel', prioritize finding their official LinkedIn profile URL. If found, analyze the profile and provide a brief 1-2 sentence 'profileSummary' focusing on their recent experience, role focus, or key skills mentioned. If you cannot find a reliable LinkedIn profile URL or relevant summary information, set 'linkedInUrl' and/or 'profileSummary' to null respectively.
- You MUST NOT make up data. If you cannot verify something from a trustworthy source, mark the corresponding JSON field as null. Do not guess.
- Only return the valid JSON object as specified below. Output NO extra commentary, introduction, or explanation before or after the JSON block.

JSON Format:
{
  "companyName": "string | null",
  "website": "string | null",
  "industry": "string | null",
  "location": "string | null", // Should reflect the most likely location found
  "companySize": "string | null",
  "keyPersonnel": [{ "name": "string", "title": "string", "linkedInUrl": "string | null", "profileSummary": "string | null" }] | null, // Max 3 relevant people. Include LI profile URL and summary if found.
  "companyOverview": "string | null", // Concise description (1-2 sentences)
  "productsServices": "string | null", // Main offerings summary
  "targetAudience": "string | null", // Typical customer profile
  "recentNewsTrigger": "string | null", // ONE significant recent event (funding, launch, acquisition, key hire) - last 12-18 months
  "potentialPainPoints": ["string"] | null, // 2-3 potential challenges *relevant to common B2B solutions* based on their industry/size/news
  "techStackHints": ["string"] | null, // Any known tech used (if discoverable and relevant)
  "conversationStarters": ["string"] | null, // 2-3 specific opening lines referencing your research findings
  "aiConfidenceScore": "'High' | 'Medium' | 'Low' | null", // Your confidence in the accuracy and completeness of these findings
  "researchTimestamp": "string", // ISO 8601 timestamp NOW
  "researchSources": ["string"] | null // Max 3-4 primary URLs used for research
}
            `;

            // --- Call Perplexity API using fetch ---
            const perplexityUrl = 'https://api.perplexity.ai/chat/completions';
            const perplexityOptions = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    model: "sonar", // Using online model
                    messages: [
                        { role: "system", content: "You are an expert sales intelligence researcher outputting ONLY valid, structured JSON based on the user's request format. You access the web to find and summarize information, including LinkedIn profiles, paying close attention to location hints." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.2,
                    max_tokens: 2000,
                    stream: false,
                })
            };

            try {
                console.log("Calling Perplexity API...");
                const perplexityResponse = await fetch(perplexityUrl, perplexityOptions);
                console.log(`Perplexity Status: ${perplexityResponse.status}`);

                if (!perplexityResponse.ok) {
                    let errorBody: string | Record<string, unknown> = `Perplexity API request failed with status ${perplexityResponse.status}`;
                    try { errorBody = await perplexityResponse.json(); } catch {} /* Ignore parsing error */
                    console.error("Perplexity API Error:", errorBody);
                    throw new Error(typeof errorBody === 'object' && errorBody !== null && 'error' in errorBody && 
                        typeof errorBody.error === 'object' && errorBody.error !== null && 'message' in errorBody.error ? 
                        String(errorBody.error.message) : 
                        typeof errorBody === 'object' && errorBody !== null && 'message' in errorBody ? 
                        String(errorBody.message) : 
                        `Perplexity API Error: ${perplexityResponse.status}`);
                }

                const perplexityData = await perplexityResponse.json();
                const aiResponseContent = perplexityData?.choices?.[0]?.message?.content;

                if (!aiResponseContent) {
                    console.error("Perplexity returned an empty response content.", perplexityData);
                    throw new Error("Perplexity returned an empty response.");
                }
                console.log("Perplexity AI Response Content Received (parsing...)");

                // --- Parse and Validate the AI response ---
                let parsedAiData;
                try {
                    parsedAiData = JSON.parse(aiResponseContent);
                } catch (parseError) {
                    console.warn("Failed to parse entire AI response as JSON. Attempting to extract JSON block.", parseError);
                    const jsonMatch = aiResponseContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch && jsonMatch[0]) {
                        try {
                             parsedAiData = JSON.parse(jsonMatch[0]);
                             console.log("Successfully extracted and parsed JSON block.");
                        } catch {
                             console.error("Failed to parse extracted JSON block.");
                             throw new Error("AI response format error: Could not parse JSON content.");
                        }
                    } else {
                        console.error("AI response did not contain a recognizable JSON block.");
                        throw new Error("AI response format error: No JSON object found.");
                    }
                }

                if (!parsedAiData || typeof parsedAiData !== 'object') {
                     throw new Error("AI response JSON structure is invalid after parsing.");
                }

                 // Ensure keyPersonnel has the correct shape
                 const validatedKeyPersonnel = (Array.isArray(parsedAiData.keyPersonnel)
                    ? parsedAiData.keyPersonnel.map((person: Record<string, unknown>) => ({
                        name: typeof person?.name === 'string' ? person.name : 'Unknown Name',
                        title: typeof person?.title === 'string' ? person.title : 'Unknown Title',
                        linkedInUrl: typeof person?.linkedInUrl === 'string' ? person.linkedInUrl : null,
                        profileSummary: typeof person?.profileSummary === 'string' ? person.profileSummary : null,
                    }))
                    : null) as KeyPersonnel[] | null;

                 // --- Populate SalesInsightReport (Success Case) ---
                 salesInsightReport = {
                     status: 'success',
                     companyName: typeof parsedAiData.companyName === 'string' ? parsedAiData.companyName : businessName,
                     website: typeof parsedAiData.website === 'string' ? parsedAiData.website : null,
                     industry: typeof parsedAiData.industry === 'string' ? parsedAiData.industry : industryHint,
                     // Use AI location first, fallback to Trestle hint
                     location: typeof parsedAiData.location === 'string' ? parsedAiData.location : trestleLocationHint,
                     companySize: typeof parsedAiData.companySize === 'string' ? parsedAiData.companySize : null,
                     keyPersonnel: validatedKeyPersonnel,
                     companyOverview: typeof parsedAiData.companyOverview === 'string' ? parsedAiData.companyOverview : null,
                     productsServices: typeof parsedAiData.productsServices === 'string' ? parsedAiData.productsServices : null,
                     targetAudience: typeof parsedAiData.targetAudience === 'string' ? parsedAiData.targetAudience : null,
                     recentNewsTrigger: typeof parsedAiData.recentNewsTrigger === 'string' ? parsedAiData.recentNewsTrigger : null,
                     potentialPainPoints: Array.isArray(parsedAiData.potentialPainPoints) ? parsedAiData.potentialPainPoints : null,
                     techStackHints: Array.isArray(parsedAiData.techStackHints) ? parsedAiData.techStackHints : null,
                     conversationStarters: Array.isArray(parsedAiData.conversationStarters) ? parsedAiData.conversationStarters : null,
                     aiConfidenceScore: typeof parsedAiData.aiConfidenceScore === 'string' && 
                                      ['High', 'Medium', 'Low'].includes(parsedAiData.aiConfidenceScore) ? 
                                      parsedAiData.aiConfidenceScore as 'High' | 'Medium' | 'Low' : 'Medium',
                     researchTimestamp: typeof parsedAiData.researchTimestamp === 'string' ? parsedAiData.researchTimestamp : new Date().toISOString(),
                     researchSources: Array.isArray(parsedAiData.researchSources) ? parsedAiData.researchSources : null,
                 };
                 console.log("Formatted Sales Insight Report on Success");

            } catch (aiError: unknown) {
                console.error("Perplexity API Interaction Error:", aiError);
                let errorMessage = "Failed to get insights from AI.";
                if (aiError instanceof Error) errorMessage = aiError.message;

                salesInsightReport = {
                    ...salesInsightReport,
                    status: 'error',
                    companyName: businessName,
                    location: trestleLocationHint, // Keep Trestle location if AI failed
                    error: errorMessage,
                    message: `AI research failed (Source: Perplexity). ${errorMessage}`,
                    researchTimestamp: new Date().toISOString(),
                };
            }

        } else {
            console.log("Trestle data did not indicate a clear business name for research.");
            salesInsightReport = {
                ...salesInsightReport,
                status: 'no_business_found',
                message: 'Trestle data did not identify a business or business name for this number.',
                researchTimestamp: new Date().toISOString(),
            };
        }

        // --- 4. Combine and Return Results ---
        const combinedResult: CombinedResult = {
            trestleData: trestleData,
            salesInsightReport: salesInsightReport
        };

        return NextResponse.json(combinedResult, { status: 200 });

    } catch (error: unknown) {
        console.error("Error in API handler:", error);
        let errorMessage = 'An internal server error occurred.';
        let statusCode = 500;

         if (error instanceof SyntaxError) {
             errorMessage = 'Invalid request format.';
             statusCode = 400;
         } else if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json({
            error: 'API processing error.',
            details: errorMessage
        } satisfies ApiErrorResponse, { status: statusCode });
    }
}

// Optional: GET handler
export async function GET() {
  return NextResponse.json({ message: 'API endpoint active. Use POST with { "phone": "number" }.' });
}