import {
  IsString,
  IsEmail,
  IsArray,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @IsString()
  ceoName: string;

  @IsEmail()
  ceoEmail: string;

  @IsString()
  @MinLength(6)
  ceoPassword: string;

  @IsArray()
  moduleKeys: string[]

  @IsOptional()
  @IsString()
  plan?: string;
}