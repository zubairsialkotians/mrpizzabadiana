import React from 'react';
import { View, Text, Linking } from 'react-native';
import { Screen, Card, KV, Button, ListItem, SectionTitle } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { confirmAction } from '../services/confirm';
import { ROLE_LABELS } from '../services/format';
import { colors } from '../theme';

// Guests: log in / register. Customers: profile, orders. Staff: their account + admin.
export default function AccountScreen({ navigation }) {
  const { user, shop, isStaff, logout } = useAuth();

  const signOut = async () => {
    if (await confirmAction('Log out?', '', 'Log out', true)) {
      const wasStaff = isStaff;
      await logout();
      if (!wasStaff) navigation.reset({ index: 0, routes: [{ name: 'Home' }] }); // staff: the app swaps back to the shop by itself
    }
  };
  const call = () => Linking.openURL(`tel:${shop.phone}`);
  const whatsapp = () => Linking.openURL(`https://wa.me/${(shop.whatsapp || shop.phone).replace(/\D/g, '').replace(/^0/, '92')}`);

  return (
    <Screen title="My account">
      {!user ? (
        <>
          <Card>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.black }}>Welcome to {shop?.name}</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>Log in to see your orders and check out faster.</Text>
          </Card>
          <Button testID="go-login" title="Log in" icon="log-in-outline" onPress={() => navigation.navigate('Login')} style={{ marginBottom: 10 }} />
          <Button testID="go-register" title="Create an account" variant="outline" onPress={() => navigation.navigate('Register')} style={{ marginBottom: 10 }} />
          <ListItem icon="receipt-outline" title="Orders on this phone" subtitle="Orders you placed without logging in" onPress={() => navigation.navigate('MyOrders')} />
        </>
      ) : (
        <>
          <Card>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.black }}>{user.name}</Text>
            <Text style={{ color: colors.muted, marginBottom: 6 }}>{user.email}</Text>
            {!!user.phone && <KV label="Phone" value={user.phone} />}
            {isStaff && <KV label="Role" value={`${ROLE_LABELS[user.role]}${user.branch ? ` · ${user.branch.name}` : ''}`} />}
            {!!user.address && <Text style={{ color: colors.text, marginTop: 4 }}>{user.address}</Text>}
          </Card>
          {isStaff ? (
            <ListItem icon="speedometer-outline" title="Shop admin" subtitle="Orders, items, stock and reports" onPress={() => navigation.navigate('AdminHome')} />
          ) : (
            <>
              <ListItem icon="receipt-outline" title="My orders" onPress={() => navigation.navigate('MyOrders')} />
              <ListItem icon="person-outline" title="Edit profile & address" onPress={() => navigation.navigate('Profile')} />
            </>
          )}
          <ListItem icon="key-outline" title={user.has_password ? 'Change password' : 'Set a password'}
            subtitle={user.has_password ? undefined : 'So you can log in on other phones'} onPress={() => navigation.navigate('Password')} />
        </>
      )}

      {!!(shop?.phone || shop?.whatsapp) && (
        <>
          <SectionTitle>Need help?</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {!!shop.phone && <Button title="Call shop" icon="call-outline" variant="ghost" onPress={call} style={{ flex: 1 }} />}
            <Button title="WhatsApp" icon="logo-whatsapp" variant="ghost" onPress={whatsapp} style={{ flex: 1 }} />
          </View>
          {!!shop.address && <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'center' }}>{shop.address}</Text>}
        </>
      )}

      {user && <Button title="Log out" variant="danger" icon="log-out-outline" onPress={signOut} style={{ marginTop: 24 }} />}
    </Screen>
  );
}
