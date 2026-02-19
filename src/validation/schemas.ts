import { z } from "zod";

export const AddressSchema = z.object({
  name: z.string().min(1).max(35).optional(),
  addressLines: z
    .array(z.string().min(1).max(35))
    .min(1, "At least one address line is required")
    .max(3),
  city: z.string().min(1).max(30),
  stateProvinceCode: z
    .string()
    .length(2, "State/province code must be exactly 2 characters")
    .optional(),
  postalCode: z.string().min(1).max(9),
  countryCode: z.string().length(2, "Country code must be exactly 2 characters"),
  residential: z.boolean().optional(),
});

export const DimensionsSchema = z.object({
  length: z.number().positive("Length must be positive"),
  width: z.number().positive("Width must be positive"),
  height: z.number().positive("Height must be positive"),
  unit: z.enum(["IN", "CM"]),
});

export const PackageWeightSchema = z.object({
  value: z.number().positive("Weight must be positive"),
  unit: z.enum(["LB", "KG", "OZ"]),
});

export const PackageSchema = z.object({
  weight: PackageWeightSchema,
  dimensions: DimensionsSchema.optional(),
});

export const RateRequestSchema = z.object({
  origin: AddressSchema,
  destination: AddressSchema,
  packages: z
    .array(PackageSchema)
    .min(1, "At least one package is required")
    .max(200),
  serviceCode: z.string().optional(),
  shipperAccountNumber: z.string().min(6).max(6).optional(),
});
