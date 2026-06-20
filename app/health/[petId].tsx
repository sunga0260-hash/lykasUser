import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../utils/api";

const GREEN = "#1E6B45";

type CareTab = "overview" | "health" | "feeding" | "behavior" | "housing";

const tabs: { key: CareTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "overview", label: "Overview", icon: "grid-outline" },
  { key: "health", label: "Health", icon: "medkit-outline" },
  { key: "feeding", label: "Feeding", icon: "restaurant-outline" },
  { key: "behavior", label: "Behavior", icon: "happy-outline" },
  { key: "housing", label: "Housing", icon: "home-outline" },
];

function daysUntil(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function formatDate(date?: string) {
  if (!date) return "Not recorded";
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(date?: string) {
  if (!date) return "Not recorded";
  return new Date(date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function StaffName({ user }: { user?: any }) {
  const name = user?.displayName || user?.email;
  if (!name) return null;
  return <Text className="mt-1 text-xs text-[#6B7280]">Recorded by {name}</Text>;
}

function EmptyCareState({ title }: { title: string }) {
  return (
    <View className="items-center rounded-3xl border border-dashed border-[#CFE0D7] bg-white p-6 dark:bg-gray-800 dark:border-gray-700">
      <Ionicons name="clipboard-outline" size={40} color="#9CA3AF" />
      <Text className="mt-3 text-center font-extrabold text-[#111827] dark:text-white">{title}</Text>
      <Text className="mt-2 text-center text-sm text-[#6B7280]">Shelter staff records will appear here once they are added.</Text>
    </View>
  );
}

function MetricCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "alert" }) {
  return (
    <View className={`flex-1 rounded-3xl border p-4 ${tone === "alert" ? "border-red-200 bg-red-50" : "border-[#DCE8E1] bg-white"} dark:bg-gray-800 dark:border-gray-700`}>
      <Text className={`text-xs font-bold uppercase ${tone === "alert" ? "text-red-500" : "text-[#6B7280]"}`}>{label}</Text>
      <Text className="mt-2 text-xl font-extrabold text-[#111827] dark:text-white" numberOfLines={2}>{value || "-"}</Text>
    </View>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mb-3 mt-2">
      <Text className="text-xl font-extrabold text-[#111827] dark:text-white">{title}</Text>
      {subtitle ? <Text className="mt-1 text-sm text-[#6B7280]">{subtitle}</Text> : null}
    </View>
  );
}

function CareRecord({ icon, title, date, children, flagged }: { icon: keyof typeof Ionicons.glyphMap; title: string; date?: string; children?: React.ReactNode; flagged?: boolean }) {
  return (
    <View className={`mb-3 rounded-3xl border bg-white p-4 dark:bg-gray-800 ${flagged ? "border-red-200" : "border-[#DCE8E1] dark:border-gray-700"}`}>
      <View className="flex-row items-start">
        <View className={`h-11 w-11 items-center justify-center rounded-full ${flagged ? "bg-red-50" : "bg-[#EAF4EE]"}`}>
          <Ionicons name={icon} size={20} color={flagged ? "#EF4444" : GREEN} />
        </View>
        <View className="ml-4 flex-1">
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 font-extrabold text-[#111827] dark:text-white">{title}</Text>
            {flagged ? <Text className="text-xs font-extrabold text-red-500">Flagged</Text> : null}
          </View>
          <Text className="mt-1 text-xs text-[#6B7280]">{formatDateTime(date)}</Text>
          {children}
        </View>
      </View>
    </View>
  );
}

export default function HealthOverview() {
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const [activeTab, setActiveTab] = useState<CareTab>("overview");
  const [vaccinations, setVaccinations] = useState<any[]>([]);
  const [vetVisits, setVetVisits] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [shelterSummary, setShelterSummary] = useState<any>(null);
  const [healthChecks, setHealthChecks] = useState<any[]>([]);
  const [feedingLogs, setFeedingLogs] = useState<any[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<any[]>([]);
  const [behaviorLogs, setBehaviorLogs] = useState<any[]>([]);
  const [cageHistory, setCageHistory] = useState<any[]>([]);
  const [quarantineHistory, setQuarantineHistory] = useState<any[]>([]);
  const [occupancy, setOccupancy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!petId) return;
    try {
      const [
        medRes,
        shelterRes,
        healthRes,
        feedingRes,
        medicationRes,
        behaviorRes,
        cageRes,
        quarantineRes,
        occupancyRes,
      ] = await Promise.allSettled([
        api.get(`/medical/summary/${petId}`),
        api.get(`/shelter-care/summary/${petId}`),
        api.get(`/shelter-care/health-checks/${petId}?limit=5`),
        api.get(`/shelter-care/feeding-logs/${petId}?limit=5`),
        api.get(`/shelter-care/medication-logs/${petId}?limit=5`),
        api.get(`/shelter-care/behavioral-obs/${petId}?limit=5`),
        api.get(`/shelter-care/cages/${petId}`),
        api.get(`/shelter-care/quarantine/${petId}`),
        api.get("/shelter-care/occupancy"),
      ]);

      if (medRes.status === "fulfilled") {
        setVaccinations(medRes.value.data.vaccinations || []);
        setVetVisits(medRes.value.data.vetVisits || []);
        setRecords(medRes.value.data.medicalRecords || []);
      }
      if (shelterRes.status === "fulfilled") setShelterSummary(shelterRes.value.data);
      if (healthRes.status === "fulfilled") setHealthChecks(healthRes.value.data.checks || []);
      if (feedingRes.status === "fulfilled") setFeedingLogs(feedingRes.value.data.logs || []);
      if (medicationRes.status === "fulfilled") setMedicationLogs(medicationRes.value.data.logs || []);
      if (behaviorRes.status === "fulfilled") setBehaviorLogs(behaviorRes.value.data.observations || []);
      if (cageRes.status === "fulfilled") setCageHistory(cageRes.value.data || []);
      if (quarantineRes.status === "fulfilled") setQuarantineHistory(quarantineRes.value.data || []);
      if (occupancyRes.status === "fulfilled") setOccupancy(occupancyRes.value.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [petId]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const nextVaccine = useMemo(() => (
    vaccinations
      .filter((v) => v.nextDueDate)
      .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())[0]
  ), [vaccinations]);

  const activeQuarantine = shelterSummary?.activeQuarantine;
  const currentCage = shelterSummary?.currentCage;
  const latestHealth = shelterSummary?.latestHealth;
  const latestFeeding = shelterSummary?.latestFeeding;
  const latestBehavior = shelterSummary?.latestBehavior;
  const latestMedication = shelterSummary?.latestMedication;
  const hasShelterRecords = healthChecks.length + feedingLogs.length + medicationLogs.length + behaviorLogs.length + cageHistory.length + quarantineHistory.length > 0;

  if (loading) return (
    <SafeAreaView className="flex-1 bg-[#F8FAF9] items-center justify-center">
      <ActivityIndicator size="large" color={GREEN} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAF9] dark:bg-gray-900">
      <View className="flex-row items-center px-6 mt-4 mb-5">
        <TouchableOpacity onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white border border-[#DCE8E1] dark:bg-gray-800">
          <Ionicons name="arrow-back" size={20} color={GREEN} />
        </TouchableOpacity>
        <View className="ml-4 flex-1">
          <Text className="text-2xl font-extrabold text-[#111827] dark:text-white">Care Overview</Text>
          <Text className="text-xs font-bold text-[#6B7280]">{healthChecks.length} checks · {feedingLogs.length} meals · {behaviorLogs.length} behavior notes</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} colors={[GREEN]} />}
      >
        {activeQuarantine ? (
          <View className="mb-5 rounded-3xl bg-red-500 p-5">
            <Text className="text-sm font-bold text-white/80">Quarantine active</Text>
            <Text className="mt-1 text-3xl font-extrabold text-white">{activeQuarantine.reason}</Text>
            <Text className="mt-2 text-white/90">Started {formatDate(activeQuarantine.startDate)}</Text>
          </View>
        ) : nextVaccine ? (
          <View className={`mb-5 rounded-3xl p-5 ${daysUntil(nextVaccine.nextDueDate) <= 7 ? "bg-red-500" : "bg-[#1E6B45]"}`}>
            <Text className="text-sm font-bold text-white/80">Next vaccine due</Text>
            <Text className="mt-1 text-4xl font-extrabold text-white">
              {daysUntil(nextVaccine.nextDueDate) <= 0 ? "Overdue" : `${daysUntil(nextVaccine.nextDueDate)} days`}
            </Text>
            <Text className="mt-2 text-white/90">{nextVaccine.vaccineName} · {formatDate(nextVaccine.nextDueDate)}</Text>
          </View>
        ) : (
          <View className="mb-5 rounded-3xl bg-[#1E6B45] p-5">
            <Text className="text-sm font-bold text-white/80">Current care status</Text>
            <Text className="mt-1 text-2xl font-extrabold text-white">{latestHealth?.condition || "Records pending"}</Text>
            <Text className="mt-2 text-white/90">{currentCage ? `Housed in ${currentCage.cageNumber}` : "Housing details will appear when assigned"}</Text>
          </View>
        )}

        <View className="mb-5 flex-row gap-3">
          <MetricCard label="Weight" value={latestHealth?.weight || "-"} />
          <MetricCard label="Condition" value={latestHealth?.condition || "-"} tone={["Poor", "Critical"].includes(latestHealth?.condition) ? "alert" : "default"} />
          <MetricCard label="Cage" value={currentCage?.cageNumber || "-"} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
          <View className="flex-row gap-2">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  className={`h-11 flex-row items-center rounded-full border px-4 ${active ? "border-[#1E6B45] bg-[#1E6B45]" : "border-[#DCE8E1] bg-white dark:bg-gray-800 dark:border-gray-700"}`}
                >
                  <Ionicons name={tab.icon} size={16} color={active ? "#FFFFFF" : GREEN} />
                  <Text className={`ml-2 text-sm font-extrabold ${active ? "text-white" : "text-[#1E6B45]"}`}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {activeTab === "overview" && (
          <>
            <SectionTitle title="Shelter Care Summary" subtitle="Latest records from shelter staff." />
            {!hasShelterRecords ? (
              <EmptyCareState title="No shelter care records yet" />
            ) : (
              <>
                {latestHealth ? (
                  <CareRecord icon="fitness-outline" title={latestHealth.condition} date={latestHealth.date} flagged={latestHealth.flagged}>
                    <Text className="mt-2 text-sm text-[#6B7280]">{latestHealth.weight || "No weight"} · {latestHealth.temperature || "No temperature"}</Text>
                    {latestHealth.notes ? <Text className="mt-1 text-sm text-[#374151] dark:text-gray-300">{latestHealth.notes}</Text> : null}
                    <StaffName user={latestHealth.checkedBy} />
                  </CareRecord>
                ) : null}
                {latestFeeding ? (
                  <CareRecord icon="restaurant-outline" title={`${latestFeeding.meal} meal`} date={latestFeeding.date}>
                    <Text className="mt-2 text-sm text-[#6B7280]">{latestFeeding.foodType || "Food not specified"} · Ate {latestFeeding.eaten || "not recorded"}</Text>
                    {latestFeeding.notes ? <Text className="mt-1 text-sm text-[#374151] dark:text-gray-300">{latestFeeding.notes}</Text> : null}
                  </CareRecord>
                ) : null}
                {latestBehavior ? (
                  <CareRecord icon="happy-outline" title={latestBehavior.mood} date={latestBehavior.date} flagged={latestBehavior.flagged}>
                    <Text className="mt-2 text-sm text-[#6B7280]">Sociability: {latestBehavior.sociability || "Not recorded"}</Text>
                    {latestBehavior.notes ? <Text className="mt-1 text-sm text-[#374151] dark:text-gray-300">{latestBehavior.notes}</Text> : null}
                  </CareRecord>
                ) : null}
                {latestMedication ? (
                  <CareRecord icon="bandage-outline" title={latestMedication.medication} date={latestMedication.date}>
                    <Text className="mt-2 text-sm text-[#6B7280]">{latestMedication.dosage || "No dosage"} · {latestMedication.frequency || "No frequency"}</Text>
                    {latestMedication.nextDoseAt ? <Text className="mt-1 text-xs font-bold text-[#D4622A]">Next dose: {formatDateTime(latestMedication.nextDoseAt)}</Text> : null}
                  </CareRecord>
                ) : null}
              </>
            )}
          </>
        )}

        {activeTab === "health" && (
          <>
            <SectionTitle title="Daily Health Checks" subtitle="Vitals, condition, and notes from shelter staff." />
            {healthChecks.length === 0 ? <EmptyCareState title="No daily health checks yet" /> : healthChecks.map((check) => (
              <CareRecord key={check._id} icon="fitness-outline" title={check.condition} date={check.date} flagged={check.flagged}>
                <Text className="mt-2 text-sm text-[#6B7280]">Weight: {check.weight || "-"} · Temperature: {check.temperature || "-"}</Text>
                {check.notes ? <Text className="mt-1 text-sm text-[#374151] dark:text-gray-300">{check.notes}</Text> : null}
                <StaffName user={check.checkedBy} />
              </CareRecord>
            ))}

            <SectionTitle title="Medication Logs" subtitle="Medicine given while under shelter care." />
            {medicationLogs.length === 0 ? <EmptyCareState title="No medication logs yet" /> : medicationLogs.map((log) => (
              <CareRecord key={log._id} icon="bandage-outline" title={log.medication} date={log.date}>
                <Text className="mt-2 text-sm text-[#6B7280]">{log.dosage || "No dosage"} · {log.frequency || "No frequency"}</Text>
                {log.reason ? <Text className="mt-1 text-sm text-[#374151] dark:text-gray-300">Reason: {log.reason}</Text> : null}
                {log.nextDoseAt ? <Text className="mt-1 text-xs font-bold text-[#D4622A]">Next dose: {formatDateTime(log.nextDoseAt)}</Text> : null}
                <StaffName user={log.administeredBy} />
              </CareRecord>
            ))}

            <SectionTitle title="Vaccinations" subtitle="Immunization and upcoming due dates." />
            {vaccinations.length === 0 ? <EmptyCareState title="No vaccination records yet" /> : vaccinations.map((v) => {
              const isDue = v.nextDueDate && new Date(v.nextDueDate) <= new Date();
              return (
                <CareRecord key={v._id} icon="shield-checkmark-outline" title={v.vaccineName} date={v.dateGiven} flagged={isDue}>
                  {v.nextDueDate ? <Text className="mt-2 text-sm text-[#6B7280]">Next: {formatDate(v.nextDueDate)}</Text> : null}
                </CareRecord>
              );
            })}

            <SectionTitle title="Vet Visits" />
            {vetVisits.length === 0 ? <EmptyCareState title="No vet visits yet" /> : vetVisits.map((visit) => (
              <CareRecord key={visit._id} icon="medical-outline" title={visit.reason} date={visit.visitDate}>
                <Text className="mt-2 text-sm text-[#6B7280]">{visit.vetName || "Clinic not recorded"}</Text>
                {visit.diagnosis ? <Text className="mt-1 text-sm text-[#374151] dark:text-gray-300">Diagnosis: {visit.diagnosis}</Text> : null}
                {visit.treatment ? <Text className="text-sm text-[#374151] dark:text-gray-300">Treatment: {visit.treatment}</Text> : null}
              </CareRecord>
            ))}

            <SectionTitle title="Medical Records" />
            {records.length === 0 ? <EmptyCareState title="No medical records yet" /> : records.map((record) => (
              <CareRecord key={record._id} icon="document-text-outline" title={record.type} date={record.date}>
                <Text className="mt-2 text-sm text-[#374151] dark:text-gray-300">{record.description}</Text>
              </CareRecord>
            ))}
          </>
        )}

        {activeTab === "feeding" && (
          <>
            <SectionTitle title="Feeding and Care Logs" subtitle="Meals, food type, amount, and appetite." />
            {feedingLogs.length === 0 ? <EmptyCareState title="No feeding logs yet" /> : feedingLogs.map((log) => (
              <CareRecord key={log._id} icon="restaurant-outline" title={`${log.meal} meal`} date={log.date}>
                <Text className="mt-2 text-sm text-[#6B7280]">{log.foodType || "Food not specified"} · {log.amount || "No amount"}</Text>
                <Text className="mt-1 text-sm font-bold text-[#1E6B45]">Ate {log.eaten || "not recorded"}</Text>
                {log.notes ? <Text className="mt-1 text-sm text-[#374151] dark:text-gray-300">{log.notes}</Text> : null}
                <StaffName user={log.loggedBy} />
              </CareRecord>
            ))}
          </>
        )}

        {activeTab === "behavior" && (
          <>
            <SectionTitle title="Behavioral Observations" subtitle="Temperament, sociability, and concerns." />
            {behaviorLogs.length === 0 ? <EmptyCareState title="No behavior observations yet" /> : behaviorLogs.map((obs) => (
              <CareRecord key={obs._id} icon="happy-outline" title={obs.mood} date={obs.date} flagged={obs.flagged}>
                <Text className="mt-2 text-sm text-[#6B7280]">Sociability: {obs.sociability || "Not recorded"}</Text>
                {obs.notes ? <Text className="mt-1 text-sm text-[#374151] dark:text-gray-300">{obs.notes}</Text> : null}
                <StaffName user={obs.observedBy} />
              </CareRecord>
            ))}
          </>
        )}

        {activeTab === "housing" && (
          <>
            <SectionTitle title="Cage and Shelter Assignment" subtitle="Current housing and location history." />
            <View className="mb-5 flex-row gap-3">
              <MetricCard label="Current Cage" value={currentCage?.cageNumber || "-"} />
              <MetricCard label="Section" value={currentCage?.section || "-"} />
              <MetricCard label="Occupied" value={occupancy?.totalActive ?? "-"} />
            </View>

            {occupancy?.bySection?.length ? (
              <View className="mb-5 rounded-3xl border border-[#DCE8E1] bg-white p-4 dark:bg-gray-800 dark:border-gray-700">
                <Text className="font-extrabold text-[#111827] dark:text-white">Shelter occupancy by section</Text>
                {occupancy.bySection.map((item: any) => (
                  <View key={item.section} className="mt-3 flex-row items-center justify-between">
                    <Text className="text-sm text-[#6B7280]">{item.section}</Text>
                    <Text className="font-extrabold text-[#111827] dark:text-white">{item.occupied}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {cageHistory.length === 0 ? <EmptyCareState title="No cage assignment history yet" /> : cageHistory.map((assignment) => (
              <CareRecord key={assignment._id} icon="home-outline" title={`Cage ${assignment.cageNumber}`} date={assignment.assignedAt}>
                <Text className="mt-2 text-sm text-[#6B7280]">{assignment.section || "Section not recorded"} · {assignment.isActive ? "Current" : `Released ${formatDate(assignment.releasedAt)}`}</Text>
                {assignment.notes ? <Text className="mt-1 text-sm text-[#374151] dark:text-gray-300">{assignment.notes}</Text> : null}
                <StaffName user={assignment.assignedBy} />
              </CareRecord>
            ))}

            <SectionTitle title="Quarantine Tracking" subtitle="Isolation history and active quarantine status." />
            {quarantineHistory.length === 0 ? <EmptyCareState title="No quarantine records yet" /> : quarantineHistory.map((record) => (
              <CareRecord key={record._id} icon="warning-outline" title={record.reason} date={record.startDate} flagged={record.isActive}>
                <Text className="mt-2 text-sm text-[#6B7280]">{record.isActive ? "Active quarantine" : `Ended ${formatDate(record.endDate)}`}</Text>
                {record.notes ? <Text className="mt-1 text-sm text-[#374151] dark:text-gray-300">{record.notes}</Text> : null}
              </CareRecord>
            ))}
          </>
        )}

        <TouchableOpacity className="mt-4 rounded-2xl border border-[#1E6B45] py-4" onPress={() => router.push(`/baby-book/${petId}` as any)}>
          <Text className="text-center font-extrabold text-[#1E6B45]">Open Baby Book</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
