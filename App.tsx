import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
} from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "./src/supabase";

WebBrowser.maybeCompleteAuthSession();

type Product = {
  id: string; title: string; game: string; description: string;
  price: number; image_url: string | null; is_available: boolean;
};
type Order = {
  id: string; amount: number; status: string; created_at: string;
  product?: { title: string; game: string };
};
type Screen = "shop" | "cart" | "orders" | "profile" | "admin" | "detail" | "checkout";

const GREEN = "#22C55E", BG = "#07110C", PANEL = "#102019", MUTED = "#9AAFA2";
const QRIS_URL = process.env.EXPO_PUBLIC_QRIS_IMAGE_URL || "";
const WA_ADMIN = process.env.EXPO_PUBLIC_ADMIN_WHATSAPP || "";

const money = (n: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(Number(n || 0));

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<Screen>("shop");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [productTitle, setProductTitle] = useState("");
  const [productGame, setProductGame] = useState("Mobile Legends");
  const [productPrice, setProductPrice] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImage, setProductImage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) refreshAll();
    else { setProducts([]); setOrders([]); setIsAdmin(false); }
  }, [session?.user?.id]);

  async function refreshAll() {
    await Promise.all([loadProducts(), loadOrders(), loadRole()]);
  }
  async function loadProducts() {
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (error) Alert.alert("Produk", error.message);
    else setProducts((data || []) as Product[]);
  }
  async function loadOrders() {
    const { data, error } = await supabase.from("orders")
      .select("id,amount,status,created_at,products(title,game)")
      .order("created_at", { ascending: false });
    if (!error) setOrders((data || []) as any);
  }
  async function loadRole() {
    const { data } = await supabase.from("profiles").select("role,display_name").eq("id", session.user.id).maybeSingle();
    setIsAdmin(data?.role === "admin");
    if (data?.display_name) setDisplayName(data.display_name);
  }

  async function authenticate() {
    if (!email.trim() || !password) return Alert.alert("Data belum lengkap", "Isi email dan password.");
    setBusy(true);
    const result = authMode === "login"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName } } });
    setBusy(false);
    if (result.error) Alert.alert("Autentikasi gagal", result.error.message);
    else if (authMode === "signup") Alert.alert("Pendaftaran berhasil", "Periksa email untuk verifikasi jika konfirmasi email diaktifkan.");
  }

  async function googleLogin() {
    const redirectTo = Linking.createURL("/");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google", options: { redirectTo, skipBrowserRedirect: true }
    });
    if (error) return Alert.alert("Google login", error.message);
    if (data.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "success" && result.url) {
        const parsed = Linking.parse(result.url);
        const params: any = parsed.queryParams || {};
        if (params.access_token && params.refresh_token) {
          const { error: e } = await supabase.auth.setSession({
            access_token: String(params.access_token), refresh_token: String(params.refresh_token)
          });
          if (e) Alert.alert("Sesi Google", e.message);
        }
      }
    }
  }

  const filteredProducts = useMemo(() => products.filter(p =>
    p.is_available && (category === "Semua" || p.game === category) &&
    (p.title + " " + p.game).toLowerCase().includes(query.toLowerCase())
  ), [products, category, query]);

  async function addProduct() {
    if (!productTitle.trim() || !productGame.trim() || !productPrice || Number(productPrice) < 0) {
      return Alert.alert("Periksa produk", "Nama, game, dan harga wajib diisi.");
    }
    setBusy(true);
    const payload = {
      title: productTitle.trim(), game: productGame.trim(),
      description: productDescription.trim(), price: Number(productPrice),
      image_url: productImage.trim() || null, is_available: true
    };
    const result = editingId
      ? await supabase.from("products").update(payload).eq("id", editingId)
      : await supabase.from("products").insert(payload);
    setBusy(false);
    if (result.error) return Alert.alert("Simpan produk gagal", result.error.message);
    resetProductForm(); await loadProducts(); Alert.alert("Berhasil", "Produk tersimpan.");
  }
  function resetProductForm() {
    setEditingId(null); setProductTitle(""); setProductGame("Mobile Legends");
    setProductPrice(""); setProductDescription(""); setProductImage("");
  }
  function editProduct(p: Product) {
    setEditingId(p.id); setProductTitle(p.title); setProductGame(p.game);
    setProductPrice(String(p.price)); setProductDescription(p.description); setProductImage(p.image_url || "");
    setScreen("admin");
  }
  async function deleteProduct(id: string) {
    Alert.alert("Hapus produk?", "Produk akan dihapus dari katalog.", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) Alert.alert("Gagal", error.message); else loadProducts();
      }}
    ]);
  }
  async function pickProductImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Izin diperlukan", "Izinkan akses galeri untuk memilih gambar.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const ext = asset.fileName?.split(".").pop() || "jpg";
    const path = `products/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("store-images").upload(path, blob, { contentType: asset.mimeType || "image/jpeg", upsert: true });
    if (error) return Alert.alert("Upload gambar", error.message);
    const { data } = supabase.storage.from("store-images").getPublicUrl(path);
    setProductImage(data.publicUrl);
  }

  async function makeOrder(product: Product) {
    if (!session?.user?.id) return;
    setBusy(true);
    const { data, error } = await supabase.from("orders").insert({
      buyer_id: session.user.id, product_id: product.id, amount: product.price, status: "awaiting_payment"
    }).select("id").single();
    setBusy(false);
    if (error) return Alert.alert("Pesanan gagal", error.message);
    setActiveOrder(data.id); setSelected(null); setScreen("checkout"); await loadOrders();
  }
  async function uploadPaymentProof(orderId: string) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Izin diperlukan", "Izinkan akses galeri.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    const asset = result.assets[0], response = await fetch(asset.uri), blob = await response.blob();
    const path = `proofs/${session.user.id}/${orderId}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, blob, { contentType: "image/jpeg" });
    if (uploadError) { setBusy(false); return Alert.alert("Upload bukti gagal", uploadError.message); }
    const { error } = await supabase.from("orders").update({ payment_proof_path: path, status: "payment_review" }).eq("id", orderId);
    setBusy(false);
    if (error) Alert.alert("Update pesanan gagal", error.message);
    else { Alert.alert("Bukti terkirim", "Admin akan memeriksa pembayaranmu."); await loadOrders(); }
  }
  async function setOrderStatus(orderId: string, status: string) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) Alert.alert("Update status gagal", error.message); else loadOrders();
  }
  async function updateProfile() {
    const { error } = await supabase.from("profiles").upsert({ id: session.user.id, display_name: displayName });
    if (error) Alert.alert("Profil", error.message); else Alert.alert("Profil", "Profil diperbarui.");
  }

  if (loading) return <SafeAreaView style={s.center}><ActivityIndicator color={GREEN} size="large" /></SafeAreaView>;

  if (!session) return <SafeAreaView style={s.container}>
    <StatusBar barStyle="light-content" />
    <View style={s.authBrand}><Text style={s.logo}>ZERO<Text style={{color: GREEN}}> STORE</Text></Text><Text style={s.muted}>GAME ACCOUNT MARKETPLACE</Text></View>
    <View style={s.panel}>
      <Text style={s.heading}>{authMode === "login" ? "Masuk ke akunmu" : "Buat akun baru"}</Text>
      {authMode === "signup" && <TextInput style={s.input} placeholder="Nama tampilan" placeholderTextColor={MUTED} value={displayName} onChangeText={setDisplayName} />}
      <TextInput style={s.input} placeholder="Email" placeholderTextColor={MUTED} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password (minimal 8 karakter)" placeholderTextColor={MUTED} secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={s.primary} onPress={authenticate} disabled={busy}><Text style={s.primaryText}>{busy ? "Memproses..." : authMode === "login" ? "LOGIN" : "DAFTAR"}</Text></TouchableOpacity>
      <TouchableOpacity style={s.outline} onPress={() => setAuthMode(authMode === "login" ? "signup" : "login")}><Text style={s.lightText}>{authMode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Login"}</Text></TouchableOpacity>
      <TouchableOpacity style={s.outline} onPress={googleLogin}><Text style={s.lightText}>Lanjutkan dengan Google</Text></TouchableOpacity>
    </View>
    <Text style={s.foot}>Gunakan akun yang aman. Jangan bagikan password atau kode verifikasi.</Text>
  </SafeAreaView>;

  function navButton(label: string, target: Screen) {
    return <TouchableOpacity onPress={() => setScreen(target)} style={[s.navItem, screen === target && s.navActive]}><Text style={[s.navText, screen === target && {color: GREEN}]}>{label}</Text></TouchableOpacity>;
  }
  function productCard(p: Product) {
    return <TouchableOpacity style={s.product} onPress={() => { setSelected(p); setScreen("detail"); }}>
      {p.image_url ? <Image source={{uri:p.image_url}} style={s.thumb}/> : <View style={s.thumbEmpty}><Text style={s.muted}>ZERO STORE</Text></View>}
      <Text style={s.productTitle} numberOfLines={2}>{p.title}</Text>
      <Text style={s.muted}>{p.game}</Text><Text style={s.price}>{money(p.price)}</Text>
    </TouchableOpacity>;
  }

  return <SafeAreaView style={s.container}>
    <StatusBar barStyle="light-content" />
    <View style={s.topbar}>
      <View><Text style={s.logo}>ZERO<Text style={{color:GREEN}}> STORE</Text></Text><Text style={s.muted}>Marketplace akun game</Text></View>
      <TouchableOpacity onPress={() => setScreen("cart")}><Text style={s.link}>Keranjang ({cart.length})</Text></TouchableOpacity>
    </View>

    {screen === "shop" && <ScrollView keyboardShouldPersistTaps="handled">
      <View style={s.banner}><Text style={s.kicker}>WELCOME TO ZERO STORE</Text><Text style={s.bannerTitle}>Level up your game.</Text><Text style={s.muted}>Cari akun game favoritmu dengan lebih mudah.</Text></View>
      <TextInput style={s.input} placeholder="Cari akun atau game..." placeholderTextColor={MUTED} value={query} onChangeText={setQuery}/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:14}}>
        {["Semua","Mobile Legends","Free Fire","PUBG Mobile","Genshin Impact","Roblox"].map(c =>
          <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[s.chip, category === c && s.chipActive]}><Text style={{color:category === c ? "#041008" : "#D9E9DE",fontWeight:"700"}}>{c}</Text></TouchableOpacity>
        )}
      </ScrollView>
      <Text style={s.section}>Akun tersedia</Text>
      <View style={s.grid}>{filteredProducts.map(p => <View key={p.id} style={s.gridCell}>{productCard(p)}</View>)}</View>
      {filteredProducts.length === 0 && <Text style={s.muted}>Belum ada produk yang cocok.</Text>}
    </ScrollView>}

    {screen === "detail" && selected && <ScrollView>
      <TouchableOpacity onPress={() => setScreen("shop")}><Text style={s.link}>← Kembali ke toko</Text></TouchableOpacity>
      {selected.image_url ? <Image source={{uri:selected.image_url}} style={s.hero}/> : null}
      <View style={s.panel}><Text style={s.muted}>{selected.game}</Text><Text style={s.heading}>{selected.title}</Text><Text style={s.priceBig}>{money(selected.price)}</Text><Text style={s.body}>{selected.description}</Text>
        <TouchableOpacity style={s.primary} onPress={() => setCart(old => old.some(x => x.id === selected.id) ? old : [...old, selected])}><Text style={s.primaryText}>TAMBAH KE KERANJANG</Text></TouchableOpacity>
        <TouchableOpacity style={s.outline} onPress={() => makeOrder(selected)} disabled={busy}><Text style={s.lightText}>{busy ? "Memproses..." : "BELI SEKARANG"}</Text></TouchableOpacity>
      </View>
    </ScrollView>}

    {screen === "cart" && <ScrollView><Text style={s.section}>Keranjang belanja</Text>
      {cart.map(p => <View key={p.id} style={s.listRow}><View style={{flex:1}}><Text style={s.productTitle}>{p.title}</Text><Text style={s.price}>{money(p.price)}</Text></View><TouchableOpacity onPress={() => setCart(old => old.filter(x => x.id !== p.id))}><Text style={s.danger}>Hapus</Text></TouchableOpacity></View>)}
      <Text style={s.heading}>Total: {money(cart.reduce((a,p)=>a+p.price,0))}</Text>
      <TouchableOpacity style={s.primary} disabled={!cart.length || busy} onPress={async () => { if(cart.length !== 1) return Alert.alert("Checkout", "Untuk sementara checkout satu produk per pesanan. Pilih satu akun terlebih dahulu."); await makeOrder(cart[0]); setCart([]); }}><Text style={s.primaryText}>LANJUT CHECKOUT</Text></TouchableOpacity>
      {cart.length > 1 && <Text style={s.muted}>Checkout multi-produk akan diaktifkan pada pengembangan berikutnya.</Text>}
    </ScrollView>}

    {screen === "checkout" && <ScrollView>
      <Text style={s.section}>Pembayaran QRIS</Text>
      <View style={s.panel}>
        <Text style={s.heading}>Pesanan berhasil dibuat</Text><Text style={s.muted}>ID: {activeOrder}</Text>
        {QRIS_URL ? <Image source={{uri:QRIS_URL}} style={s.qris} resizeMode="contain"/> : <Text style={s.warning}>QRIS belum dikonfigurasi admin.</Text>}
        <Text style={s.body}>Scan QRIS menggunakan aplikasi pembayaran yang mendukung. Bayar sesuai total pesanan, lalu unggah bukti pembayaran di bawah. Pesanan diproses setelah admin memverifikasi pembayaran.</Text>
        <TouchableOpacity style={s.primary} onPress={() => activeOrder && uploadPaymentProof(activeOrder)} disabled={busy}><Text style={s.primaryText}>{busy ? "Mengunggah..." : "UPLOAD BUKTI PEMBAYARAN"}</Text></TouchableOpacity>
        <TouchableOpacity style={s.outline} onPress={() => setScreen("orders")}><Text style={s.lightText}>Lihat pesanan saya</Text></TouchableOpacity>
      </View>
    </ScrollView>}

    {screen === "orders" && <ScrollView><Text style={s.section}>Riwayat pesanan</Text>
      {orders.map(o => <View key={o.id} style={s.panel}><Text style={s.productTitle}>{(o as any).products?.title || "Pesanan akun game"}</Text><Text style={s.price}>{money(o.amount)}</Text><Text style={s.muted}>ID: {o.id}</Text><Text style={s.status}>Status: {o.status}</Text>
        {o.status === "awaiting_payment" && <TouchableOpacity style={s.outline} onPress={() => {setActiveOrder(o.id);setScreen("checkout");}}><Text style={s.lightText}>Bayar sekarang</Text></TouchableOpacity>}
      </View>)}
      {orders.length === 0 && <Text style={s.muted}>Belum ada transaksi.</Text>}
    </ScrollView>}

    {screen === "profile" && <ScrollView><Text style={s.section}>Profil pengguna</Text><View style={s.panel}>
      <Text style={s.muted}>Email</Text><Text style={s.body}>{session.user.email}</Text>
      <TextInput style={s.input} placeholder="Nama tampilan" placeholderTextColor={MUTED} value={displayName} onChangeText={setDisplayName}/>
      <TouchableOpacity style={s.primary} onPress={updateProfile}><Text style={s.primaryText}>SIMPAN PROFIL</Text></TouchableOpacity>
      <TouchableOpacity style={s.outline} onPress={() => supabase.auth.signOut()}><Text style={s.lightText}>KELUAR</Text></TouchableOpacity>
    </View></ScrollView>}

    {screen === "admin" && isAdmin && <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={s.section}>Dashboard admin</Text><View style={s.panel}>
        <Text style={s.heading}>{editingId ? "Edit produk" : "Tambah produk"}</Text>
        <TextInput style={s.input} placeholder="Nama akun / judul produk" placeholderTextColor={MUTED} value={productTitle} onChangeText={setProductTitle}/>
        <TextInput style={s.input} placeholder="Game (contoh: Mobile Legends)" placeholderTextColor={MUTED} value={productGame} onChangeText={setProductGame}/>
        <TextInput style={s.input} placeholder="Harga dalam Rupiah" placeholderTextColor={MUTED} keyboardType="numeric" value={productPrice} onChangeText={setProductPrice}/>
        <TextInput style={[s.input,{height:90}]} multiline placeholder="Deskripsi dan spesifikasi akun" placeholderTextColor={MUTED} value={productDescription} onChangeText={setProductDescription}/>
        <TextInput style={s.input} placeholder="URL gambar (opsional)" placeholderTextColor={MUTED} value={productImage} onChangeText={setProductImage}/>
        <TouchableOpacity style={s.outline} onPress={pickProductImage}><Text style={s.lightText}>PILIH GAMBAR DARI GALERI</Text></TouchableOpacity>
        <TouchableOpacity style={s.primary} onPress={addProduct} disabled={busy}><Text style={s.primaryText}>{busy ? "Menyimpan..." : "SIMPAN PRODUK"}</Text></TouchableOpacity>
        {editingId && <TouchableOpacity style={s.outline} onPress={resetProductForm}><Text style={s.lightText}>BATAL EDIT</Text></TouchableOpacity>}
      </View>
      <Text style={s.section}>Kelola produk</Text>
      {products.map(p => <View key={p.id} style={s.listRow}><View style={{flex:1}}><Text style={s.productTitle}>{p.title}</Text><Text style={s.price}>{money(p.price)}</Text></View><TouchableOpacity onPress={() => editProduct(p)}><Text style={s.link}>Edit</Text></TouchableOpacity><TouchableOpacity onPress={() => deleteProduct(p.id)}><Text style={s.danger}>Hapus</Text></TouchableOpacity></View>)}
      <Text style={s.section}>Verifikasi pesanan</Text>
      {orders.map(o => <View key={o.id} style={s.panel}><Text style={s.muted}>#{o.id}</Text><Text style={s.price}>{money(o.amount)}</Text><Text style={s.status}>{o.status}</Text>
        {o.status === "payment_review" && <View style={s.actions}><TouchableOpacity style={s.primary} onPress={() => setOrderStatus(o.id,"paid")}><Text style={s.primaryText}>TANDAI DIBAYAR</Text></TouchableOpacity><TouchableOpacity style={s.outline} onPress={() => setOrderStatus(o.id,"cancelled")}><Text style={s.lightText}>TOLAK / BATALKAN</Text></TouchableOpacity></View>}
        {o.status === "paid" && <TouchableOpacity style={s.primary} onPress={() => setOrderStatus(o.id,"completed")}><Text style={s.primaryText}>SELESAIKAN PESANAN</Text></TouchableOpacity>}
      </View>)}
    </ScrollView>}

    {!((screen === "admin" && isAdmin) || screen === "shop" || (screen === "detail" && selected) || screen === "cart" || screen === "orders" || screen === "profile" || screen === "checkout") && <Text style={s.muted}>Halaman tidak tersedia.</Text>}

    <View style={s.bottomNav}>
      {navButton("Beranda","shop")}{navButton("Keranjang","cart")}{navButton("Pesanan","orders")}
      {isAdmin && navButton("Admin","admin")}{navButton("Profil","profile")}
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:BG,paddingHorizontal:16,paddingTop:12},
  center:{flex:1,backgroundColor:BG,alignItems:"center",justifyContent:"center"},
  authBrand:{alignItems:"center",marginTop:55,marginBottom:24},
  logo:{fontSize:25,fontWeight:"900",color:"#F4FFF7",letterSpacing:1},
  muted:{color:MUTED,fontSize:12,marginTop:4},
  panel:{backgroundColor:PANEL,borderRadius:17,padding:16,marginVertical:8,gap:11},
  heading:{fontSize:21,fontWeight:"900",color:"#F4FFF7"},
  input:{backgroundColor:"#07150E",borderWidth:1,borderColor:"#244332",borderRadius:11,padding:13,color:"white",marginTop:8},
  primary:{backgroundColor:GREEN,borderRadius:11,padding:14,alignItems:"center",marginTop:6},
  primaryText:{color:"#041008",fontWeight:"900"},
  outline:{borderWidth:1,borderColor:"#42634D",borderRadius:11,padding:13,alignItems:"center",marginTop:6},
  lightText:{color:"#DDF7E5",fontWeight:"700"},
  foot:{color:MUTED,textAlign:"center",fontSize:11,marginTop:20},
  topbar:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:14},
  link:{color:"#86EFAC",fontWeight:"800",padding:7},
  banner:{backgroundColor:"#123522",borderRadius:17,padding:19,marginBottom:15},
  kicker:{color:"#86EFAC",fontWeight:"900",fontSize:11},
  bannerTitle:{color:"white",fontSize:25,fontWeight:"900",marginVertical:8},
  section:{color:"white",fontSize:18,fontWeight:"900",marginVertical:12},
  chip:{paddingHorizontal:13,paddingVertical:9,borderRadius:20,backgroundColor:PANEL,marginRight:8},
  chipActive:{backgroundColor:GREEN},
  grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between"},
  gridCell:{width:"48%",marginBottom:12},
  product:{backgroundColor:PANEL,borderRadius:14,padding:9},
  thumb:{height:105,borderRadius:9,backgroundColor:"#1B3024"},
  thumbEmpty:{height:105,borderRadius:9,backgroundColor:"#1B3024",alignItems:"center",justifyContent:"center"},
  productTitle:{color:"white",fontWeight:"800",marginTop:8},
  price:{color:"#86EFAC",fontWeight:"900",marginTop:7},
  priceBig:{color:"#86EFAC",fontSize:23,fontWeight:"900"},
  body:{color:"#D5E5DA",lineHeight:21},
  hero:{height:220,borderRadius:15,marginVertical:10},
  qris:{height:245,width:"100%",backgroundColor:"white",borderRadius:12},
  warning:{color:"#FBBF24",fontWeight:"800"},
  listRow:{backgroundColor:PANEL,borderRadius:12,padding:13,marginVertical:5,flexDirection:"row",alignItems:"center",gap:12},
  danger:{color:"#FCA5A5",fontWeight:"800",padding:6},
  status:{color:"#D7E8DC",marginTop:5,fontWeight:"700"},
  actions:{gap:7},
  bottomNav:{flexDirection:"row",justifyContent:"space-around",borderTopWidth:1,borderTopColor:"#20372A",paddingVertical:8,marginTop:8},
  navItem:{paddingHorizontal:7,paddingVertical:7},
  navActive:{borderBottomWidth:2,borderBottomColor:GREEN},
  navText:{color:MUTED,fontSize:11,fontWeight:"700"}
});
