import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RegraModulo, RegrasModulosService } from '@/services/base.service';
import DynamicRuleTabContent from '@/components/regras/DynamicRuleTabContent';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export const TabTaxasImpostos = () => {
    const queryClient = useQueryClient();

    const { data: dynamicModules = [], isLoading } = useQuery<RegraModulo[]>({
        queryKey: ["regras_modulos"],
        queryFn: () => RegrasModulosService.listar(),
    });

    const createModuloMutation = useMutation({
        mutationFn: () => RegrasModulosService.criar({
            nome: 'Taxas e Impostos',
            slug: 'taxas_impostos',
            descricao: 'Gerencie taxas e impostos, como ISS',
            module_type: 'tax'
        }, true),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["regras_modulos"] });
            toast.success("Módulo de Taxas inicializado com sucesso!");
        },
        onError: (error: any) => {
            toast.error("Erro ao inicializar o módulo de taxas.", { description: error.message });
        }
    });

    const modulo = dynamicModules.find(
        (m) => m.module_type === 'tax' || m.slug === 'taxas-impostos' || m.slug === 'taxas_impostos'
    );

    React.useEffect(() => {
        if (!isLoading && !modulo && !createModuloMutation.isPending) {
            createModuloMutation.mutate();
        }
    }, [isLoading, modulo, createModuloMutation.isPending, createModuloMutation.mutate]);

    if (isLoading || createModuloMutation.isPending || !modulo) {
        return <Card className="p-5 text-center text-muted-foreground">Preparando módulo de Taxas e Impostos...</Card>;
    }

    return (
        <DynamicRuleTabContent
            moduloId={modulo.id}
            title="Taxas e Impostos"
            description="Gerencie taxas e impostos, como ISS."
        />
    );
};
