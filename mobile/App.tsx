import { StatusBar } from "expo-status-bar";
import { ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const API_BASE = "http://127.0.0.1:8000";
const USER_ID = 1;

type Dashboard = {
  user: {
    display_name: string;
    level: number;
    xp: number;
    physique_goal: string;
  };
  streak: { current_days: number };
  rpg_stats: Record<string, number>;
  active_quests: Array<{ id: number; title: string; description: string; xp_reward: number }>;
};

type Coach = {
  note: string;
  cached: boolean;
};

export default function App() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [sessionName, setSessionName] = useState("Deep Work Block");
  const [loading, setLoading] = useState(true);

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  async function load() {
    setLoading(true);
    try {
      const [nextDashboard, nextCoach] = await Promise.all([
        request<Dashboard>(`/dashboard/${USER_ID}`),
        request<Coach>(`/users/${USER_ID}/coach`),
      ]);
      setDashboard(nextDashboard);
      setCoach(nextCoach);
    } catch (error) {
      Alert.alert("API unavailable", error instanceof Error ? error.message : "Could not load CodeForge.");
    } finally {
      setLoading(false);
    }
  }

  async function logSession() {
    await request(`/users/${USER_ID}/workouts`, {
      method: "POST",
      body: JSON.stringify({
        name: sessionName,
        muscle_group: "Mobile",
        intensity: 7,
        duration_minutes: 45,
      }),
    });
    await load();
  }

  async function generateQuest() {
    await request(`/users/${USER_ID}/quests/generate`, { method: "POST" });
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && !dashboard) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#42d8ff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>CodeForge</Text>
        <Text style={styles.title}>{dashboard?.user.display_name}</Text>
        <Text style={styles.subtitle}>{dashboard?.user.physique_goal}</Text>

        <View style={styles.metrics}>
          <Metric label="Level" value={String(dashboard?.user.level ?? 0)} />
          <Metric label="XP" value={String(dashboard?.user.xp ?? 0)} />
          <Metric label="Streak" value={`${dashboard?.streak.current_days ?? 0}d`} />
        </View>

        <Card title="AI Coach">
          <Text style={styles.body}>{coach?.note}</Text>
        </Card>

        <Card title="Log Coding Session">
          <TextInput value={sessionName} onChangeText={setSessionName} style={styles.input} />
          <Pressable style={styles.button} onPress={logSession}>
            <Text style={styles.buttonText}>Log 45 Minute Session</Text>
          </Pressable>
        </Card>

        <Card title="Active Quests">
          {dashboard?.active_quests.length ? (
            dashboard.active_quests.map((quest) => (
              <View key={quest.id} style={styles.quest}>
                <Text style={styles.questTitle}>{quest.title}</Text>
                <Text style={styles.body}>{quest.description}</Text>
                <Text style={styles.pill}>{quest.xp_reward} XP</Text>
              </View>
            ))
          ) : (
            <Text style={styles.body}>No active quests.</Text>
          )}
          <Pressable style={styles.buttonSecondary} onPress={generateQuest}>
            <Text style={styles.buttonSecondaryText}>Generate AI Quest</Text>
          </Pressable>
        </Card>

        <Card title="RPG Stats">
          {Object.entries(dashboard?.rpg_stats ?? {}).map(([key, value]) => (
            <View key={key} style={styles.statRow}>
              <Text style={styles.statLabel}>{title(key)}</Text>
              <Text style={styles.statValue}>{value}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Card({ title: cardTitle, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{cardTitle}</Text>
      {children}
    </View>
  );
}

function title(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070812" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#070812" },
  content: { padding: 20, gap: 16 },
  kicker: { color: "#42d8ff", fontWeight: "800", textTransform: "uppercase" },
  title: { color: "#f3f7ff", fontSize: 34, fontWeight: "900" },
  subtitle: { color: "#9aa7c4", fontSize: 16, lineHeight: 22 },
  metrics: { flexDirection: "row", gap: 10 },
  metric: { flex: 1, backgroundColor: "#111625", borderColor: "#27314e", borderWidth: 1, borderRadius: 8, padding: 14 },
  metricLabel: { color: "#9aa7c4", fontWeight: "700" },
  metricValue: { color: "#f3f7ff", fontSize: 22, fontWeight: "900", marginTop: 4 },
  card: { backgroundColor: "#111625", borderColor: "#27314e", borderWidth: 1, borderRadius: 8, padding: 16, gap: 12 },
  cardTitle: { color: "#f3f7ff", fontSize: 18, fontWeight: "900" },
  body: { color: "#9aa7c4", lineHeight: 21 },
  input: { borderColor: "#27314e", borderWidth: 1, borderRadius: 6, padding: 12, color: "#f3f7ff", backgroundColor: "#090c18" },
  button: { backgroundColor: "#7c5cff", borderRadius: 6, minHeight: 44, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "white", fontWeight: "900" },
  buttonSecondary: { borderColor: "#42d8ff", borderWidth: 1, borderRadius: 6, minHeight: 44, alignItems: "center", justifyContent: "center" },
  buttonSecondaryText: { color: "#42d8ff", fontWeight: "900" },
  quest: { borderColor: "#27314e", borderWidth: 1, borderRadius: 8, padding: 12, gap: 6, backgroundColor: "#171d31" },
  questTitle: { color: "#f3f7ff", fontWeight: "900" },
  pill: { color: "#42d8ff", fontWeight: "900" },
  statRow: { flexDirection: "row", justifyContent: "space-between", borderBottomColor: "#27314e", borderBottomWidth: 1, paddingVertical: 8 },
  statLabel: { color: "#9aa7c4", fontWeight: "700" },
  statValue: { color: "#f3f7ff", fontWeight: "900" },
});
