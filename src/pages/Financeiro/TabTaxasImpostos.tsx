import React from 'react';

export const TabTaxasImpostos = () => {
    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="font-semibold text-foreground">Taxas e Impostos</h2>
                    <p className="text-sm text-muted-foreground">
                        Gerencie taxas e impostos, como ISS.
                    </p>
                </div>
            </div>
            <div className="rounded-xl border bg-card p-5 text-center text-muted-foreground">
                Modulo de Taxas e Impostos em construção.
            </div>
        </div>
    );
};
