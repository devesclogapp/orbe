import React from 'react';

export const TabMeiosPagamento = () => {
    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="font-semibold text-foreground">Meios de Pagamento</h2>
                    <p className="text-sm text-muted-foreground">
                        Gerencie modalidades financeiras, liquidações e prazos.
                    </p>
                </div>
            </div>
            <div className="rounded-xl border bg-card p-5 text-center text-muted-foreground">
                Modulo de Meios de Pagamento em construção.
            </div>
        </div>
    );
};
