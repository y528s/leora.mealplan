/**
 * THE MEAL PLAN
 *
 * One shared plan for the whole family, for one week at a time. Everybody sees
 * the same thing — that was the point.
 *
 * Tap a meal to see the recipe and what it costs.
 */

import { useState } from 'react';
import { View } from 'react-native';
import {
  Body,
  Button,
  Card,
  Chip,
  ChipRow,
  Divider,
  Empty,
  Heading,
  Label,
  Loading,
  Row,
  Screen,
  Small,
  Title,
  useTheme,
} from '../../components/ui';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { useAsync } from '../../lib/use-async';
import {
  DAY_NAMES,
  DAY_SHORT,
  canApprove,
  formatMoney,
  weekStartFor,
  type Meal,
  type MealPlan,
} from '../../lib/types';
import { KASHRUT_CATEGORIES } from '../../lib/food-rules';
import { space } from '../../lib/theme';

export default function PlanScreen() {
  const c = useTheme();
  const { family, role } = useStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [openMeal, setOpenMeal] = useState<string | null>(null);

  // Which week are we looking at? 0 = this week, 1 = next week.
  const target = new Date();
  target.setDate(target.getDate() + weekOffset * 7);
  const weekStart = weekStartFor(target);

  const { data, loading, reload } = useAsync(async () => {
    if (!family) return { plan: null as MealPlan | null, meals: [] as Meal[] };

    const { data: plan } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('family_id', family.id)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (!plan) return { plan: null, meals: [] as Meal[] };

    const { data: meals } = await supabase
      .from('meals')
      .select('*')
      .eq('plan_id', plan.id)
      .order('day_of_week', { ascending: true });

    return { plan: plan as MealPlan, meals: (meals ?? []) as Meal[] };
  }, [family?.id, weekStart]);

  if (loading) return <Loading label="Loading this week…" />;

  const plan = data?.plan ?? null;
  const meals = data?.meals ?? [];

  const weekLabel = (() => {
    const d = new Date(`${weekStart}T12:00:00`);
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    const fmt = (x: Date) => x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(d)} – ${fmt(end)}`;
  })();

  const totalProtein = meals.reduce((sum, m) => sum + (m.protein_grams ?? 0), 0);

  return (
    <Screen>
      <Title sub={weekLabel}>
        {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekLabel}
      </Title>

      {/* --------------------------------------------------------- week switcher */}
      <Row>
        <Button
          variant="secondary"
          title="←"
          onPress={() => setWeekOffset((w) => w - 1)}
          style={{ flex: 1 }}
        />
        <Button
          variant={weekOffset === 0 ? 'primary' : 'secondary'}
          title="Today"
          onPress={() => setWeekOffset(0)}
          style={{ flex: 2 }}
        />
        <Button
          variant="secondary"
          title="→"
          onPress={() => setWeekOffset((w) => w + 1)}
          style={{ flex: 1 }}
        />
      </Row>

      {/* ------------------------------------------------------------ the week */}
      {!plan ? (
        <Empty
          emoji="📅"
          title="No plan for this week yet"
          body={
            canApprove(role)
              ? 'Go to the Owner tab and tap "Make this week\'s plan".'
              : 'A parent needs to generate the plan. You can suggest meals from the Suggest tab!'
          }
        />
      ) : (
        <>
          {/* Summary strip — the numbers a parent actually cares about. */}
          <Card>
            <Row style={{ justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Body style={{ fontSize: 22, fontWeight: '800' }}>{meals.length}</Body>
                <Small>meals</Small>
              </View>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Body style={{ fontSize: 22, fontWeight: '800' }}>
                  {formatMoney(plan.est_total_cents)}
                </Body>
                <Small>estimated</Small>
              </View>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Body style={{ fontSize: 22, fontWeight: '800' }}>{totalProtein}g</Body>
                <Small>protein</Small>
              </View>
            </Row>
            {family?.weekly_budget_cents ? (
              <>
                <Divider />
                <Small>
                  {(plan.est_total_cents ?? 0) <= family.weekly_budget_cents
                    ? `Under your ${formatMoney(family.weekly_budget_cents)} budget ✓`
                    : `Over your ${formatMoney(family.weekly_budget_cents)} budget`}
                </Small>
              </>
            ) : null}
          </Card>

          {plan.notes ? (
            <Card>
              <Label>Note from the planner</Label>
              <Body muted>{plan.notes}</Body>
            </Card>
          ) : null}

          {/* One card per day. */}
          {DAY_NAMES.map((dayName, dow) => {
            const dayMeals = meals.filter((m) => m.day_of_week === dow);
            if (dayMeals.length === 0) return null;

            return (
              <View key={dow} style={{ gap: space.sm }}>
                <Label>{dayName}</Label>
                {dayMeals.map((meal) => {
                  const isOpen = openMeal === meal.id;
                  const kashrut = KASHRUT_CATEGORIES.find((k) => k.value === meal.kashrut);

                  return (
                    <Card
                      key={meal.id}
                      onPress={() => setOpenMeal(isOpen ? null : meal.id)}
                    >
                      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, gap: space.xs }}>
                          <Body style={{ fontSize: 17, fontWeight: '700' }}>{meal.title}</Body>
                          {meal.description ? <Small>{meal.description}</Small> : null}
                        </View>
                        <Body muted>{isOpen ? '−' : '+'}</Body>
                      </Row>

                      <ChipRow>
                        {kashrut ? (
                          <Chip
                            label={`${kashrut.emoji} ${kashrut.label}`}
                            tone={meal.kashrut === 'meat' ? 'accent' : meal.kashrut === 'dairy' ? 'primary' : 'neutral'}
                          />
                        ) : null}
                        {meal.cuisine ? <Chip label={meal.cuisine} /> : null}
                        {meal.protein_grams ? <Chip label={`${meal.protein_grams}g protein`} tone="primary" /> : null}
                        {meal.est_cost_cents ? <Chip label={formatMoney(meal.est_cost_cents)} /> : null}
                      </ChipRow>

                      {/* Recipe only appears when you tap — keeps the week scannable. */}
                      {isOpen ? (
                        <>
                          <Divider />
                          <Label>You need</Label>
                          {meal.ingredients.map((ing, i) => (
                            <Row key={i} style={{ justifyContent: 'space-between' }}>
                              <Body muted style={{ flex: 1 }}>
                                {ing.name}
                              </Body>
                              <Small>{ing.quantity}</Small>
                            </Row>
                          ))}

                          <Divider />
                          <Label>How to make it</Label>
                          {meal.instructions.map((step, i) => (
                            <Row key={i} style={{ alignItems: 'flex-start' }}>
                              <Body style={{ color: c.primary, fontWeight: '800', width: 22 }}>
                                {i + 1}
                              </Body>
                              <Body muted style={{ flex: 1 }}>
                                {step}
                              </Body>
                            </Row>
                          ))}
                        </>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}
