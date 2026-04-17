import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/consortiums - Listar todos os consórcios
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const consortiums = await db.consortium.findMany({
      where: {
        ...(status && { status }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { installments: true },
        },
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    return NextResponse.json(consortiums);
  } catch (error) {
    console.error("Erro ao buscar consórcios:", error);
    return NextResponse.json(
      { error: "Falha ao buscar consórcios" },
      { status: 500 }
    );
  }
}

// POST /api/consortiums - Criar consórcio
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      description,
      totalAmount,
      monthlyPayment,
      installmentCount,
      group,
      quota,
      administrator,
      startDate,
      categoryId,
      accountId,
    } = body;

    if (!description || description.trim() === "") {
      return NextResponse.json(
        { error: "Descrição do consórcio é obrigatória" },
        { status: 400 }
      );
    }

    if (totalAmount === undefined || totalAmount <= 0) {
      return NextResponse.json(
        { error: "Valor total do consórcio é obrigatório e deve ser maior que zero" },
        { status: 400 }
      );
    }

    if (monthlyPayment === undefined || monthlyPayment <= 0) {
      return NextResponse.json(
        { error: "Valor da parcela mensal é obrigatório e deve ser maior que zero" },
        { status: 400 }
      );
    }

    if (!installmentCount || installmentCount <= 0) {
      return NextResponse.json(
        { error: "Quantidade de parcelas é obrigatória e deve ser maior que zero" },
        { status: 400 }
      );
    }

    const start = startDate ? new Date(startDate) : new Date();

    // Gerar as parcelas do consórcio
    const installmentsData = Array.from({ length: installmentCount }, (_, i) => {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + i);

      return {
        number: i + 1,
        amount: monthlyPayment,
        dueDate,
        status: "PENDING" as const,
      };
    });

    const consortium = await db.consortium.create({
      data: {
        description: description.trim(),
        group: group?.trim() || "",
        quota: quota?.trim() || "",
        administrator: administrator?.trim() || "",
        totalAmount,
        monthlyPayment,
        installmentCount,
        startDate: start,
        categoryId: categoryId || null,
        accountId: accountId || null,
        installments: {
          create: installmentsData,
        },
      },
      include: {
        installments: true,
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    return NextResponse.json(consortium, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar consórcio:", error);
    return NextResponse.json(
      { error: "Falha ao criar consórcio" },
      { status: 500 }
    );
  }
}

// PUT /api/consortiums - Atualizar consórcio
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, description, group, quota, administrator, totalAmount, monthlyPayment, status, nextAssemblyDate, categoryId, accountId, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID do consórcio é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.consortium.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Consórcio não encontrado" },
        { status: 404 }
      );
    }

    const consortium = await db.consortium.update({
      where: { id },
      data: {
        ...(description !== undefined && { description: description.trim() }),
        ...(group !== undefined && { group: group.trim() || "" }),
        ...(quota !== undefined && { quota: quota.trim() || "" }),
        ...(administrator !== undefined && { administrator: administrator.trim() || "" }),
        ...(totalAmount !== undefined && { totalAmount }),
        ...(monthlyPayment !== undefined && { monthlyPayment }),
        ...(status !== undefined && { status }),
        ...(nextAssemblyDate !== undefined && { nextAssemblyDate: nextAssemblyDate ? new Date(nextAssemblyDate) : null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(accountId !== undefined && { accountId: accountId || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        _count: {
          select: { installments: true },
        },
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    return NextResponse.json(consortium);
  } catch (error) {
    console.error("Erro ao atualizar consórcio:", error);
    return NextResponse.json(
      { error: "Falha ao atualizar consórcio" },
      { status: 500 }
    );
  }
}

// DELETE /api/consortiums - Excluir consórcio
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID do consórcio é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await db.consortium.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Consórcio não encontrado" },
        { status: 404 }
      );
    }

    await db.consortium.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Consórcio excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir consórcio:", error);
    return NextResponse.json(
      { error: "Falha ao excluir consórcio" },
      { status: 500 }
    );
  }
}
