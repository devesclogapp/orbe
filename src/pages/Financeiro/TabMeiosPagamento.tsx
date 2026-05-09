import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RegraModulo, RegrasModulosService } from '@/services/base.service';
import DynamicRuleTabContent from '@/components/regras/DynamicRuleTabContent';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export const TabMeiosPagamento = () => {
    const queryClient = useQueryClient();

    const { data: dynamicModules = [], isLoading } = useQuery<RegraModulo[]>({
        queryKey: ["regras_modulos"],
        queryFn: () => RegrasModulosService.listar(),
    });

    const createModuloMutation = useMutation({
        mutationFn: () => RegrasModulosService.criar({
            nome: 'Meios de Pagamento',
            slug: 'meios_pagamento',
            descricao: 'Gerencie modalidades financeiras, liquidações e prazos',
            module_type: 'financial'
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["regras_modulos"] });
            toast.success("Módulo Meios de Pagamento inicializado com sucesso!");
        },
        onError: (error: any) => {
            toast.error("Erro ao inicializar o módulo financeiro.", { description: error.message });
        }
    });

    const modulo = dynamicModules.find(
        (m) => m.module_type === 'financial' || m.slug === 'meios-pagamento' || m.slug === 'meios_pagamento'
    );

    if (isLoading) {
        return <Card className="p-5 text-center text-muted-foreground">Carregando módulo...</Card>;
    }

    if (!modulo) {
        return (
            <Card className="p-5 text-center space-y-4">
                <p className="text-muted-foreground">O módulo de sistema para Meios de Pagamento ainda não foi configurado nesta instalação.</p>
                <Button
                    onClick={() => createModuloMutation.mutate()}
                    disabled={createModuloMutation.isPending}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    {createModuloMutation.isPending ? "Inicializando..." : "Inicializar Módulo de Pagamentos"}
                </Button>
            </Card>
        );
    }

    return (
        <DynamicRuleTabContent
            moduloId={modulo.id}
            title="Meios de Pagamento"
            description="Gerencie modalidades financeiras, liquidações e prazos."
        />
    );
};
