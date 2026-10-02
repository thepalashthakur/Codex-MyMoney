import { NextRequest } from "next/server";
import { handleOne } from "@/lib/finance-api";
type Context = { params: Promise<{ resource: string; id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) { const { resource, id } = await params; return handleOne(request, resource, id, "PATCH"); }
export async function DELETE(request: NextRequest, { params }: Context) { const { resource, id } = await params; return handleOne(request, resource, id, "DELETE"); }
