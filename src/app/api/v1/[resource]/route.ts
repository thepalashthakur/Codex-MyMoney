import { NextRequest } from "next/server";
import { handleCreate, handleList } from "@/lib/finance-api";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: NextRequest, { params }: Context) { return handleList(request, (await params).resource); }
export async function POST(request: NextRequest, { params }: Context) { return handleCreate(request, (await params).resource); }
