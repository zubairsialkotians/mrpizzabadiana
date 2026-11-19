import React from 'react';
import { Text } from 'react-native';
import { Screen, Fab, ListItem, Badge, Loading, Empty, ErrorBox, Card } from '../components/ui';
import { useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme';

export default function BranchesScreen({ navigation }) {
  const { reloadBranches } = useAuth();
  const { data, loading, error, refresh, refreshing, reload } = useLoad(async () => {
    const r = await api.branches();
    reloadBranches();
    return r.branches;
  });

  return (
    <>
      <Screen title="Branches" onRefresh={refresh} refreshing={refreshing}>
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <Text style={{ color: colors.primaryDark }}>Online orders go to the main branch. You can move a new order to another branch from the order page.</Text>
        </Card>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.length
          ? <Empty icon="business-outline" text="No branches yet" />
          : data.map((b) => (
            <ListItem
              key={b.id}
              icon="business-outline"
              title={b.name}
              badge={b.is_main ? <Badge status="confirmed" label="Main" /> : b.status !== 'active' ? <Badge status={b.status} /> : null}
              subtitle={b.address || undefined}
              meta={b.admin ? `Admin: ${b.admin.name} · ${b.admin.email}` : 'No branch admin login (you manage it)'}
              onPress={() => navigation.navigate('BranchForm', { branch: b })}
            />
          ))}
        <Text style={{ height: 60 }} />
      </Screen>
      <Fab label="Branch" onPress={() => navigation.navigate('BranchForm')} />
    </>
  );
}
