import React from 'react';
import { View, Text, Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Card, KV, Button, ListItem, SectionTitle } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { MenuSyncCard } from '../components/MenuSync';
import { PrinterCard } from '../components/PrintBill';
import { OfflineOrdersCard } from '../components/OfflineOrders';
import { offlineStatus } from '../services/offlineOrders';
import { confirmAction } from '../services/confirm';
import { ROLE_LABELS } from '../services/format';
import { colors } from '../theme';

// Guests: log in / register. Customers: profile, orders. Staff: their account + admin.
export default function AccountScreen({ navigation }) {
  const { user, shop, isStaff, isTeam, isRider, isCashier, isSeller, logout, deleteAccount } = useAuth();

  const signOut = async () => {
    const wasStaff = isStaff || isTeam || isCashier;
    // Staff: orders taken offline stay on this device and are sent when this shop's staff log in here again
    const left = wasStaff ? offlineStatus().orders.length : 0;
    const warn = left ? `${left} order${left > 1 ? 's' : ''} taken offline ${left > 1 ? 'are' : 'is'} not sent yet: ${left > 1 ? 'they stay' : 'it stays'} on this device and ${left > 1 ? 'are' : 'is'} sent when staff log in here again.` : '';
    if (await confirmAction('Log out?', warn, 'Log out', true)) {
      await logout();
      if (!wasStaff) navigation.reset({ index: 0, routes: [{ name: 'Home' }] }); // staff: the app swaps back to the shop by itself
    }
  };
  const call = () => Linking.openURL(`tel:${shop.phone}`);
  const whatsapp = () => Linking.openURL(`https://wa.me/${(shop.whatsapp || shop.phone).replace(/\D/g, '').replace(/^0/, '92')}`);
  // Play Store requirement: customers can delete their account in the app.
  // The server marks it deleted and signs it out everywhere; it can't log in again.
  const [deleting, setDeleting] = React.useState(false);
  const requestDeletion = async () => {
    if (!(await confirmAction('Delete your account?',
      'Your account will be deleted and you will be logged out. You will not be able to log in with it again.',
      'Delete account', true))) return;
    setDeleting(true);
    try {
      await deleteAccount();
      Toast.show({ type: 'success', text1: 'Your account has been deleted' });
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not delete your account', text2: e.message, visibilityTime: 6000 });
      setDeleting(false);
    }
  };

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
            {(isStaff || isTeam || isCashier) && <KV label="Role" value={`${ROLE_LABELS[user.role]}${user.branch ? ` · ${user.branch.name}` : ''}`} />}
            {!!user.address && <Text style={{ color: colors.text, marginTop: 4 }}>{user.address}</Text>}
          </Card>
          {isStaff ? (
            <ListItem icon="speedometer-outline" title="Shop admin" subtitle="Orders, items, stock and reports" onPress={() => navigation.navigate('AdminHome')} />
          ) : isCashier ? (
            <ListItem icon="receipt-outline" title="My orders" subtitle="Take orders and manage the ones you took" onPress={() => navigation.navigate('AdminOrders')} />
          ) : isTeam ? (
            <ListItem icon={isRider ? 'bicycle-outline' : 'restaurant-outline'} title={isRider ? 'My deliveries' : 'Kitchen orders'} onPress={() => navigation.navigate('TeamHome')} />
          ) : (
            <>
              <ListItem icon="receipt-outline" title="My orders" onPress={() => navigation.navigate('MyOrders')} />
              <ListItem icon="person-outline" title="Edit profile & address" onPress={() => navigation.navigate('Profile')} />
            </>
          )}
          <ListItem icon="key-outline" title={user.has_password ? 'Change password' : 'Set a password'}
            subtitle={user.has_password ? undefined : 'So you can log in on other phones'} onPress={() => navigation.navigate('Password')} />

          {/* Owner / branch admin / cashier take orders: menu copy and printer for this phone / tablet */}
          {isSeller && (
            <>
              <SectionTitle>Offline orders</SectionTitle>
              <OfflineOrdersCard />
              <SectionTitle>Menu on this device</SectionTitle>
              <MenuSyncCard />
              <SectionTitle>Printer on this device</SectionTitle>
              <PrinterCard />
            </>
          )}
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

      <SectionTitle>About</SectionTitle>
      <ListItem icon="shield-checkmark-outline" title="Privacy policy" subtitle="What we collect and how we use it" onPress={() => navigation.navigate('PrivacyPolicy')} />
      {user && user.kind === 'customer' && (
        <ListItem icon="trash-outline" title="Delete my account" subtitle="Remove your account and personal data" onPress={deleting ? undefined : requestDeletion} />
      )}

      {user && <Button title="Log out" variant="danger" icon="log-out-outline" onPress={signOut} style={{ marginTop: 24 }} />}
    </Screen>
  );
}
