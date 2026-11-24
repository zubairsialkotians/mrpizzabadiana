import React from 'react';
import { Text } from 'react-native';
import { Screen, Fab, ListItem, Badge, Loading, Empty, ErrorBox, Card, SectionTitle } from '../components/ui';
import { useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme';

// Owner: kitchen and rider logins
export default function TeamScreen({ navigation }) {
  const { branches } = useAuth();
  const { data, loading, error, refresh, refreshing, reload } = useLoad(() => api.team().then((r) => r.team));
  const multi = branches.length > 1;

  const group = (role, title, icon) => {
    const list = (data || []).filter((m) => m.role === role);
    return (
      <>
        <SectionTitle>{title}</SectionTitle>
        {!list.length ? <Text style={{ color: colors.muted, marginBottom: 10 }}>None yet</Text> : list.map((m) => (
          <ListItem
            key={m.id}
            icon={icon}
            title={m.name}
            badge={m.status !== 'active' ? <Badge status="inactive" label="Disabled" /> : null}
            subtitle={[m.email, m.phone].filter(Boolean).join(' · ')}
            meta={multi || !m.branch_id ? m.branch_name : undefined}
            onPress={() => navigation.navigate('TeamForm', { member: m })}
          />
        ))}
      </>
    );
  };

  return (
    <>
      <Screen title="Staff logins" onRefresh={refresh} refreshing={refreshing}>
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <Text style={{ color: colors.primaryDark }}>
            Confirmed orders show in the kitchen of their branch. When the kitchen marks an order ready, riders see it and can accept it. Cashiers take orders at the counter or on the phone; those orders are confirmed straight away. Everyone logs in from "My account" with the email and password you set here.
          </Text>
        </Card>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.length ? (
          <Empty icon="people-outline" text="No kitchen, rider or cashier logins yet" />
        ) : (
          <>
            {group('kitchen', 'Kitchen', 'restaurant-outline')}
            {group('rider', 'Riders', 'bicycle-outline')}
            {group('cashier', 'Cashiers', 'calculator-outline')}
          </>
        )}
        <Text style={{ height: 60 }} />
      </Screen>
      <Fab label="Login" onPress={() => navigation.navigate('TeamForm')} />
    </>
  );
}
