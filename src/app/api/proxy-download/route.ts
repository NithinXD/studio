import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    // The Next.js server fetches the file from Supabase. 
    // Servers do not enforce CORS policies, so this succeeds.
    const supabaseResponse = await fetch(url);
    
    if (!supabaseResponse.ok) {
      return new Response(`Failed to fetch from Supabase: ${supabaseResponse.statusText}`, { 
        status: supabaseResponse.status 
      });
    }

    // Buffer the file into memory instead of streaming. 
    // Since PDFs are capped at 10MB, this is completely safe and avoids Next.js stream compatibility bugs.
    const buffer = await supabaseResponse.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': supabaseResponse.headers.get('Content-Type') || 'application/pdf',
        'Content-Length': buffer.byteLength.toString()
      },
    });
  } catch (error: any) {
    console.error('Proxy download error:', error);
    return new Response(`Proxy Error: ${error?.message || 'Unknown internal error'}`, { status: 500 });
  }
}
